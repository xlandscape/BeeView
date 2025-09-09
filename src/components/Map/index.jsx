import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setLandUseData, setNectarMax } from '../../store/slices/mapSlice';
// import DeckGL from '@deck.gl/react';
import {Map as MapLibre, NavigationControl, Popup, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {GeoJsonLayer} from 'deck.gl';
import { getLandUseColor, getNectarColor, getPollenColor } from '../../utils/colorScales';
// import maplibregl from 'maplibre-gl'; // Import maplibre-gl
import 'maplibre-gl/dist/maplibre-gl.css';
// import LandUseLayer from './LandUseLayer';
// import MapControls from './MapControls';
import { selectFeature } from '../../store/reducers/selectionReducer';
import { loadViewportData, debounce, getViewportConfig, setViewportConfig } from '../../utils/viewportLoader';

// Disable viewport queries (for debugging)
// Only enable this if you know what you are doing, as viewport queries
// will restrict the data that is loaded to the current viewport and will
// have the side effect that all statistical graphs will adapt accordingly
setViewportConfig({ USE_VIEWPORT_QUERIES: false });

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

  const activeFilters = useSelector((state) => state.map.activeL1Filters);
  const layerVisibility = useSelector(state => state.layers);

  // Debounced viewport data loading with longer delay for zoom changes
  const debouncedLoadViewportData = useCallback(
    debounce(async (currentViewState, interactionType = 'pan') => {
      if (!currentViewState) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('Loading viewport data for:', currentViewState, 'interaction:', interactionType);
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
    [] // Remove dispatch from dependencies
  );

  // Load initial viewport data only once
  useEffect(() => {
    debouncedLoadViewportData(INITIAL_VIEW_STATE);
  }, []); // Empty dependency array - run only once

  // Handle viewport changes
  const handleViewStateChange = useCallback((evt) => {
    const newViewState = evt.viewState;
    
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
