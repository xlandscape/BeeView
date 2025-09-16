import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setLandUseData, setNectarMax, setBeePopulationData, setBeePopulationMetrics } from '../../store/slices/mapSlice';
// import DeckGL from '@deck.gl/react';
import {Map as MapLibre, NavigationControl, Popup, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {GeoJsonLayer, ScatterplotLayer} from 'deck.gl';
import { getLandUseColor, getNectarColor, getPollenColor, getBeePopulationColor, getBeePopulationMaxValues } from '../../utils/colorScales';
// import maplibregl from 'maplibre-gl'; // Import maplibre-gl
import 'maplibre-gl/dist/maplibre-gl.css';
// import LandUseLayer from './LandUseLayer';
// import MapControls from './MapControls';
import { selectFeature } from '../../store/reducers/selectionReducer';
import { loadViewportData, loadViewportDataForTimePoint, loadTimePointData, loadBeePopulationData, loadBeePopulationTimeSeries, loadBeePopulationMetrics, debounce, getViewportConfig, setViewportConfig, isFullDatasetCached } from '../../utils/viewportLoader';
import { buildApiUrl } from '../../config/api';

// Disable viewport queries (for debugging)
// Only enable this if you know what you are doing, as viewport queries
// will restrict the data that is loaded to the current viewport and will
// have the side effect that all statistical graphs will adapt accordingly
setViewportConfig({ USE_VIEWPORT_QUERIES: false,
  ENABLE_CACHING: true  // Enable caching to prevent redundant API calls
 });

const INITIAL_VIEW_STATE = {
  latitude: 44.029,
  longitude: 1.135,
  zoom: 10,
  bearing: 0,
  pitch: 0
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

function DeckGLOverlay(props) {
  const overlay = useControl(() => new DeckOverlay(props));
  overlay.setProps(props);
  return null;
}

function Map() {
  const dispatch = useDispatch();
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [nectarMax, setNectarData] = useState(null);
  const [pollenMax, setPollenData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastZoom, setLastZoom] = useState(INITIAL_VIEW_STATE.zoom);
  const lastProcessedTimePoint = useRef(null);
  const [beePopulationData, setBeePopulationDataState] = useState(null);
  const [beePopulationTimeSeries, setBeePopulationTimeSeries] = useState(null);
  const [beePopulationMaxValues, setBeePopulationMaxValues] = useState({});
  const [beehiveLocation, setBeehiveLocation] = useState(null);

  const activeFilters = useSelector((state) => state.map.activeL1Filters);
  const layerVisibility = useSelector(state => state.layers);
  const { selectedTimePoint } = useSelector(state => state.time);

  // Debounced viewport data loading with longer delay for zoom changes
  const debouncedLoadViewportData = useCallback(
    debounce(async (currentViewState, interactionType = 'pan') => {
      if (!currentViewState) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('Loading viewport data for:', currentViewState, 'interaction:', interactionType);
        
        // Load full dataset (GeoJSON + max nectar/pollen values)
        console.log('Loading full viewport data (GeoJSON + max values)');
        const data = await loadViewportData(currentViewState);
        
        setGeoJsonData(data.geoJson);
        setNectarData(data.nectar);
        setPollenData(data.pollen);
        
        // Update Redux store
        dispatch(setLandUseData(data.geoJson));
        dispatch(setNectarMax(data.nectar));
        
      } catch (err) {
        console.error('Error loading viewport data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 1500), // 1.5 second debounce for stability
    [] // No dependencies - this only loads GeoJSON and max values
  );

  // Separate function for loading only time-specific data
  const debouncedLoadTimePointData = useCallback(
    debounce(async (currentViewState, timePoint) => {
      if (!currentViewState || !timePoint) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log(`Loading time-specific data for time point: ${timePoint}`);
        
        // Load only nectar/pollen data for the specific time point
        const timeData = await loadTimePointData(currentViewState, timePoint);
        
        // Update only nectar and pollen data, keep existing GeoJSON
        setNectarData(timeData.nectar);
        setPollenData(timeData.pollen);
        
        // Update Redux store with new nectar data
        dispatch(setNectarMax(timeData.nectar));
        
      } catch (err) {
        console.error('Error loading time-specific data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 800), // Shorter debounce for time changes (more responsive)
    [] // No dependencies
  );

  // Load initial viewport data only once (GeoJSON + max values)
  useEffect(() => {
    console.log('Loading initial GeoJSON and max values data...');
    debouncedLoadViewportData(INITIAL_VIEW_STATE);
  }, []); // Empty dependency array - run only once

  // Load beehive location data once
  useEffect(() => {
    const loadBeehiveLocation = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/beehive-location'));
        if (response.ok) {
          const location = await response.json();
          setBeehiveLocation(location);
          console.log('Beehive location loaded:', location);
        } else {
          console.warn('Beehive location not found');
        }
      } catch (error) {
        console.error('Error loading beehive location:', error);
      }
    };
    
    loadBeehiveLocation();
  }, []); // Empty dependency array - run only once

  // Load time-specific data when selected time point changes
  useEffect(() => {
    console.log('Map component: selectedTimePoint changed to:', selectedTimePoint);
    
    // Skip if no time point selected or if it's the same as last processed
    if (!selectedTimePoint || selectedTimePoint === lastProcessedTimePoint.current) {
      return;
    }
    
    // Check if viewport queries are disabled and we have cached data
    const config = getViewportConfig();
    if (!config.USE_VIEWPORT_QUERIES && config.ENABLE_CACHING && isFullDatasetCached(selectedTimePoint)) {
      console.log(`Cached time-specific data available for time point ${selectedTimePoint} - skipping API call`);
      lastProcessedTimePoint.current = selectedTimePoint;
      return;
    }
    
    console.log('Loading time-specific nectar/pollen data for time point:', selectedTimePoint);
    lastProcessedTimePoint.current = selectedTimePoint;
    debouncedLoadTimePointData(viewState || INITIAL_VIEW_STATE, selectedTimePoint);
  }, [selectedTimePoint, debouncedLoadTimePointData]);

  // Load bee population data when selected time point changes
  useEffect(() => {
    if (selectedTimePoint) {
      const loadBeeData = async () => {
        try {
          const data = await loadBeePopulationData(selectedTimePoint);
          setBeePopulationDataState(data);
          dispatch(setBeePopulationData(data));
        } catch (error) {
          console.error('Failed to load bee population data:', error);
        }
      };
      loadBeeData();
    }
  }, [selectedTimePoint, dispatch]);

  // Load bee population time series and metrics on mount
  useEffect(() => {
    const loadBeeMetadata = async () => {
      try {
        const [timeSeries, metrics] = await Promise.all([
          loadBeePopulationTimeSeries(),
          loadBeePopulationMetrics()
        ]);
        
        setBeePopulationTimeSeries(timeSeries);
        setBeePopulationMaxValues(getBeePopulationMaxValues(timeSeries));
        dispatch(setBeePopulationMetrics(metrics));
      } catch (error) {
        console.error('Failed to load bee population metadata:', error);
      }
    };
    loadBeeMetadata();
  }, [dispatch]);

  // Handle viewport changes
  const handleViewStateChange = useCallback((evt) => {
    const newViewState = evt.viewState;
    setViewState(newViewState);
    
    // Skip loading data if viewport queries are disabled
    const config = getViewportConfig();
    if (!config.USE_VIEWPORT_QUERIES) {
      console.log('Viewport queries disabled - skipping data reload on viewport change');
      return;
    }
    
    // Detect if this is primarily a zoom change
    const zoomChange = Math.abs(newViewState.zoom - lastZoom) > 0.5;
    setLastZoom(newViewState.zoom);
    
    // Use longer debounce for zoom changes
    if (zoomChange) {
      console.log('Zoom change detected, using longer debounce');
      // For zoom changes, wait longer before loading new data
      setTimeout(() => {
        debouncedLoadViewportData(newViewState, 'zoom');
      }, 1000); // Additional 1 second delay for zoom
    } else {
      // Regular pan/move operations
      debouncedLoadViewportData(newViewState, 'pan');
    }
  }, [debouncedLoadViewportData, lastZoom]);

  // Helper function to create bee population layers
  const createBeePopulationLayers = () => {
    if (!geoJsonData || !beePopulationData) return [];
    
    const beePopulationLayers = [];
    
    // Mapping of layer names to data field names
    const layerMetricMapping = {
      'TotalEggs': 'totalEggs',
      'TotalLarvae': 'totalLarvae', 
      'TotalPupae': 'totalPupae',
      'TotalIHbees': 'totalIHbees',
      'TotalForagers': 'totalForagers',
      'TotalWorkers': 'totalIHbees + totalForagers',
      'TotalDroneEggs': 'totalDroneEggs',
      'TotalDroneLarvae': 'totalDroneLarvae',
      'TotalDronePupae': 'totalDronePupae',
      'TotalDrones': 'totalDrones'
    };
    
    // Create layers for each visible bee population metric
    Object.entries(layerMetricMapping).forEach(([layerName, metricName]) => {
      if (layerVisibility[layerName]?.visible && beePopulationData.data[metricName] !== undefined) {
        const metricValue = beePopulationData.data[metricName];
        const maxValue = beePopulationMaxValues[metricName];
        
        beePopulationLayers.push(
          new GeoJsonLayer({
            id: `bee-${layerName.toLowerCase()}-layer`,
            data: geoJsonData.features.filter((feature) =>
              activeFilters.length === 0 || activeFilters.includes(feature.properties.L1_label)
            ),
            filled: true,
            getFillColor: (feature) => {
              // Apply the same bee population value to all features
              // In a real scenario, you might want different values per feature
              return getBeePopulationColor(metricValue, metricName, maxValue);
            },
            pickable: true,
            autoHighlight: true,
            onClick: info => {
              if (info.object) {
                dispatch(selectFeature([info.object.id]));
              }
            },
          })
        );
      }
    });
    
    return beePopulationLayers;
  };

  const layers = [
    layerVisibility.LULC.visible && 
    geoJsonData &&
      new GeoJsonLayer({
        id: 'geojson-layer',
        data: geoJsonData.features.filter((feature) =>
          activeFilters.length === 0 || activeFilters.includes(feature.properties.L1_label)
        ),
        filled: true,
        getFillColor: (feature, {index}) => {
          return getLandUseColor(feature.properties.L1_label);
      },
        pickable: true,
        autoHighlight: true,
        onClick: (info) => setSelected(info.object),
      }),
    layerVisibility.Nectar.visible && 
    nectarMax &&
      new GeoJsonLayer({ 
        id: 'nectar-layer',
        data: geoJsonData.features.filter((feature) =>
          activeFilters.length === 0 || activeFilters.includes(feature.properties.L1_label)
        ),
        filled: true,
        getFillColor: (feature, {index}) => {
          if (!nectarMax || !nectarMax[feature.id]) {
            return [200, 200, 200, 100];
          }
          const nectar = nectarMax[feature.id];
          return getNectarColor(nectar);
        },
        pickable: true,
        autoHighlight: true,
        onClick: info => {
          if (info.object) {
            dispatch(selectFeature([info.object.id]));
          }
        },
      }),
    layerVisibility.Pollen?.visible && 
    pollenMax &&
      new GeoJsonLayer({ 
        id: 'pollen-layer',
        data: geoJsonData.features.filter((feature) =>
          activeFilters.length === 0 || activeFilters.includes(feature.properties.L1_label)
        ),
        filled: true,
        getFillColor: (feature, {index}) => {
          if (!pollenMax || !pollenMax[feature.id]) {
            return [200, 200, 200, 100];
          }
          const pollen = pollenMax[feature.id];
          return typeof getPollenColor === 'function' ? getPollenColor(pollen) : [255, 200, 0, 180];
        },
        pickable: true,
        autoHighlight: true,
        onClick: info => {
          if (info.object) {
            dispatch(selectFeature([info.object.id]));
          }
        },
      }),
    // Beehive location layer
    layerVisibility.Beehive?.visible && 
    beehiveLocation &&
      new ScatterplotLayer({
        id: 'beehive-layer',
        data: [{
          coordinates: [beehiveLocation.x, beehiveLocation.y],
          radius: 200 // 200 meter radius circle
        }],
        getPosition: d => d.coordinates,
        getRadius: d => d.radius,
        getFillColor: [255, 165, 0, 200], // Orange color with transparency
        getLineColor: [255, 140, 0, 255], // Darker orange outline
        getLineWidth: 3,
        stroked: true,
        filled: true,
        radiusUnits: 'meters',
        pickable: true,
        autoHighlight: true,
      }),
    // Add bee population layers
    ...createBeePopulationLayers(),
  ].filter(Boolean);

  // Show loading state
  if (loading && !geoJsonData) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div>Loading viewport data...</div>
        {error && <div style={{ color: 'red', marginTop: '10px' }}>Error: {error}</div>}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapLibre 
        initialViewState={INITIAL_VIEW_STATE}
        onMove={handleViewStateChange}
        mapStyle={MAP_STYLE}
      >
        {selected && (
          <Popup
            key={selected.properties.L1_label}
            anchor="bottom"
            style={{zIndex: 10}} /* position above deck.gl canvas */
            longitude={selected.geometry.coordinates[0][0][0][0]}
            latitude={selected.geometry.coordinates[0][0][0][1]}
          >
            <div>{selected.properties.L1_label}</div>
          </Popup>
        )}
        <DeckGLOverlay layers={layers} /* interleaved*/ />
        <NavigationControl position="top-left" />
      </MapLibre>
      
      {/* Loading indicator for viewport changes */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          Loading...
        </div>
      )}
      
      {/* Error indicator */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(255, 0, 0, 0.8)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}

export default Map;
