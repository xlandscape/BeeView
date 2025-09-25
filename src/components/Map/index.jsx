import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setLandUseData, setNectarMax, setBeePopulationData, setBeePopulationMetrics, setVegetationCodesMap } from '../../store/slices/mapSlice';
// import DeckGL from '@deck.gl/react';
import {Map as MapLibre, NavigationControl, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {GeoJsonLayer, ScatterplotLayer} from 'deck.gl';
import { getLandUseColor, getLevel1LandUseColor, getLevel2LandUseColor, getLevel3LandUseColor, getNectarColor, getPollenColor, getVegetationColor, getBeePopulationMaxValues } from '../../utils/colorScales';
// import maplibregl from 'maplibre-gl'; // Import maplibre-gl
import 'maplibre-gl/dist/maplibre-gl.css';
// import LandUseLayer from './LandUseLayer';
// import MapControls from './MapControls';
import { selectFeature, clearSelection } from '../../store/reducers/selectionReducer';
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
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastZoom, setLastZoom] = useState(INITIAL_VIEW_STATE.zoom);
  const lastProcessedTimePoint = useRef(null);
  const [beePopulationData, setBeePopulationDataState] = useState(null);
  const [beePopulationTimeSeries, setBeePopulationTimeSeries] = useState(null);
  const [beePopulationMaxValues, setBeePopulationMaxValues] = useState({});
  const [beehiveLocation, setBeehiveLocation] = useState(null);
  const [vegetationMapping, setVegetationMapping] = useState(null);

  const activeFilters = useSelector((state) => state.map.activeL1Filters);
  const layerVisibility = useSelector(state => state.layers);
  const { selectedTimePoint } = useSelector(state => state.time);
  const selectedFeatureIds = useSelector(state => state.selection.selectedFeatureIds);

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

  // Load vegetation mapping data once  
  useEffect(() => {
    const loadVegetationMapping = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/vegetation-codes-map'));
        if (response.ok) {
          const data = await response.json();
          setVegetationMapping(data.mapping);
          dispatch(setVegetationCodesMap(data.mapping));
          console.log('Vegetation mapping loaded:', data.mapping);
        } else {
          console.warn('Vegetation mapping not found');
        }
      } catch (error) {
        console.error('Error loading vegetation mapping:', error);
      }
    };
    
    loadVegetationMapping();
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

  // Note: Bee population data has no spatial resolution - it represents colony-wide metrics
  // that are the same for all polygons. Therefore, bee population data is only displayed
  // in time series charts, not as map layers.

  // Optimize data filtering with useMemo to prevent re-filtering on every render
  const filteredGeoJsonData = useMemo(() => {
    if (!geoJsonData) return null;
    return {
      ...geoJsonData,
      features: geoJsonData.features.filter((feature) =>
        activeFilters.length === 0 || activeFilters.includes(feature.properties.L1_label)
      )
    };
  }, [geoJsonData, activeFilters]);

  // Simplified click handler - only handles selection
  const handleFeatureClick = useCallback((info) => {
    if (info.object) {
      dispatch(selectFeature(info.object.id));
    }
  }, [dispatch]);

  // Helper function to get fill color with opacity-based highlighting
  const getHighlightedFillColor = useCallback((feature, baseColor) => {
    const hasSelection = selectedFeatureIds.length > 0;
    if (!hasSelection) {
      return [baseColor[0], baseColor[1], baseColor[2], 200]; // Default opacity when nothing is selected
    }
    
    const isSelected = selectedFeatureIds.includes(feature.id);
    const opacity = isSelected ? 255 : 80; // Selected: full opacity, others: very dimmed
    return [baseColor[0], baseColor[1], baseColor[2], opacity];
  }, [selectedFeatureIds]);

  // Get line color for selection highlighting (simplified)
  const getSelectionLineColor = useCallback((feature) => {
    const hasSelection = selectedFeatureIds.length > 0;
    if (!hasSelection) {
      return [50, 50, 50, 100]; // Default line when nothing is selected
    }
    
    const isSelected = selectedFeatureIds.includes(feature.id);
    const opacity = isSelected ? 200 : 50; // Selected: visible lines, others: very faint
    return [50, 50, 50, opacity];
  }, [selectedFeatureIds]);

  // Get line width - no special highlighting
  const getSelectionLineWidth = useCallback((feature) => {
    return 1; // Consistent line width for all features
  }, []);

  // Handle map background clicks to clear selection
  const handleMapClick = useCallback((info, event) => {
    // If no object was clicked (clicking on background), clear the selection
    if (!info.object) {
      dispatch(clearSelection());
    }
  }, [dispatch]);

  const layers = [
    layerVisibility.LULC.visible && 
    filteredGeoJsonData &&
      new GeoJsonLayer({
        id: 'geojson-layer',
        data: filteredGeoJsonData.features,
        filled: true,
        getFillColor: (feature) => {
          const baseColor = getLandUseColor(feature.properties.L3_label, 3);
          return getHighlightedFillColor(feature, baseColor);
        },
        stroked: true,
        getLineColor: getSelectionLineColor,
        getLineWidth: getSelectionLineWidth,
        lineWidthMinPixels: 1,
        pickable: true,
        autoHighlight: true,
        onClick: handleFeatureClick,
        // Performance optimizations
        updateTriggers: {
          getFillColor: [layerVisibility.LULC.visible, selectedFeatureIds],
          getLineColor: [selectedFeatureIds],
          getLineWidth: [selectedFeatureIds]
        },
        wireframe: false,
      }),
    layerVisibility.Nectar.visible && 
    nectarMax &&
    filteredGeoJsonData &&
      new GeoJsonLayer({ 
        id: 'nectar-layer',
        data: filteredGeoJsonData.features,
        filled: true,
        getFillColor: (feature) => {
          if (!nectarMax || !nectarMax[feature.id]) {
            const baseColor = [200, 200, 200, 255];
            return getHighlightedFillColor(feature, baseColor);
          }
          const nectar = nectarMax[feature.id];
          const baseColor = getNectarColor(nectar);
          return getHighlightedFillColor(feature, baseColor);
        },
        stroked: true,
        getLineColor: getSelectionLineColor,
        getLineWidth: getSelectionLineWidth,
        lineWidthMinPixels: 1,
        pickable: true,
        autoHighlight: true,
        onClick: handleFeatureClick,
        // Performance optimizations
        updateTriggers: {
          getFillColor: [nectarMax, layerVisibility.Nectar.visible, selectedFeatureIds],
          getLineColor: [selectedFeatureIds],
          getLineWidth: [selectedFeatureIds]
        },
        wireframe: false,
      }),
    layerVisibility.Pollen?.visible && 
    pollenMax &&
    filteredGeoJsonData &&
      new GeoJsonLayer({ 
        id: 'pollen-layer',
        data: filteredGeoJsonData.features,
        filled: true,
        getFillColor: (feature) => {
          if (!pollenMax || !pollenMax[feature.id]) {
            const baseColor = [200, 200, 200, 255];
            return getHighlightedFillColor(feature, baseColor);
          }
          const pollen = pollenMax[feature.id];
          const baseColor = typeof getPollenColor === 'function' ? getPollenColor(pollen) : [255, 200, 0, 255];
          return getHighlightedFillColor(feature, baseColor);
        },
        stroked: true,
        getLineColor: getSelectionLineColor,
        getLineWidth: getSelectionLineWidth,
        lineWidthMinPixels: 1,
        pickable: true,
        autoHighlight: true,
        onClick: handleFeatureClick,
        // Performance optimizations
        updateTriggers: {
          getFillColor: [pollenMax, layerVisibility.Pollen.visible, selectedFeatureIds],
          getLineColor: [selectedFeatureIds],
          getLineWidth: [selectedFeatureIds]
        },
        wireframe: false,
      }),
    // Vegetation layer
    layerVisibility.Vegetation?.visible && 
    vegetationMapping &&
    filteredGeoJsonData &&
      new GeoJsonLayer({ 
        id: 'vegetation-layer',
        data: filteredGeoJsonData.features,
        filled: true,
        getFillColor: (feature) => {
          const l1Code = feature.properties.L1_code;
          const l2Code = feature.properties.L2_code;
          const l3Code = feature.properties.L3_code;
          
          if (!l1Code || !l2Code || !l3Code) {
            const baseColor = [200, 200, 200, 255]; // Gray for missing codes
            return getHighlightedFillColor(feature, baseColor);
          }
          
          const codeKey = `${l1Code}-${l2Code}-${l3Code}`;
          const vegetationType = vegetationMapping[codeKey];
          
          if (!vegetationType) {
            const baseColor = [200, 200, 200, 255]; // Gray for unmapped
            return getHighlightedFillColor(feature, baseColor);
          }
          
          const baseColor = getVegetationColor(vegetationType);
          return getHighlightedFillColor(feature, baseColor);
        },
        stroked: true,
        getLineColor: getSelectionLineColor,
        getLineWidth: getSelectionLineWidth,
        lineWidthMinPixels: 1,
        pickable: true,
        autoHighlight: true,
        onClick: handleFeatureClick,
        // Performance optimizations
        updateTriggers: {
          getFillColor: [vegetationMapping, layerVisibility.Vegetation.visible, selectedFeatureIds],
          getLineColor: [selectedFeatureIds],
          getLineWidth: [selectedFeatureIds]
        },
        wireframe: false,
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
        updateTriggers: {
          getFillColor: [beehiveLocation],
          getPosition: [beehiveLocation]
        }
      })
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
        <DeckGLOverlay layers={layers} onClick={handleMapClick} /* interleaved*/ />
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
