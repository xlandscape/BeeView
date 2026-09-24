import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setLandUseData, setNectarMax, setBeePopulationData, setBeePopulationMetrics, setVegetationCodesMap } from '../../store/slices/mapSlice';
// import DeckGL from '@deck.gl/react';
import {Map as MapLibre, NavigationControl, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {GeoJsonLayer, ScatterplotLayer, TextLayer} from 'deck.gl';
import { getLandUseColor, getLevel1LandUseColor, getLevel2LandUseColor, getLevel3LandUseColor, getNectarColor, getPollenColor, getVegetationColor, getBeePopulationMaxValues } from '../../utils/colorScales';
// import maplibregl from 'maplibre-gl'; // Import maplibre-gl
import 'maplibre-gl/dist/maplibre-gl.css';
// import LandUseLayer from './LandUseLayer';
// import MapControls from './MapControls';
import { selectFeature, clearSelection } from '../../store/reducers/selectionReducer';
import { setHivePosition } from '../../store/slices/simulationSlice';
import { loadViewportData, loadViewportDataForTimePoint, loadTimePointData, loadBeePopulationData, loadBeePopulationTimeSeries, loadBeePopulationMetrics, debounce, getViewportConfig, setViewportConfig, isFullDatasetCached } from '../../utils/viewportLoader';
import { loadApplicationsData } from '../../utils/applicationsLoader';
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

function getHiveMarkerRadiusPixels(zoom) {
  if (zoom >= 14) return 18;
  if (zoom >= 12) return 15;
  if (zoom >= 10) return 12;
  if (zoom >= 8) return 10;
  return 8;
}

function offsetHiveCoordinates([lon, lat], role) {
  const delta = 0.00008;
  if (role === 'treated') return [lon + delta, lat + delta];
  if (role === 'untreated') return [lon - delta, lat - delta];
  return [lon, lat];
}

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
  const [vegetationMapping, setVegetationMapping] = useState(null);
  const [applicationsData, setApplicationsData] = useState([]);
  const [debugMode, setDebugMode] = useState(false); // 🐛 Debug mode toggle
  const [hiveHoverInfo, setHiveHoverInfo] = useState(null);
  const hiveMarkerRadius = useMemo(() => getHiveMarkerRadiusPixels(viewState.zoom), [viewState.zoom]);

  const activeFilters = useSelector((state) => state.map.activeL1Filters);
  const layerVisibility = useSelector(state => state.layers);
  const { selectedTimePoint } = useSelector(state => state.time);
  const selectedFeatureIds = useSelector(state => state.selection.selectedFeatureIds);
  const { availableRuns, baselineRunId, scenarioRunId, viewRunIds } = useSelector(state => state.runs);
  const hivePlacementMode = useSelector(state => state.simulation.hivePlacementMode);
  const simForm = useSelector(state => state.simulation.form);
  const simPanelOpen = useSelector(state => state.simulation.panelOpen);

  // Compute simulation hive marker position (WGS84) from form coordinates (EPSG:3857)
  const simHiveMarker = useMemo(() => {
    const x = simForm.BeeHaveMapCenterPointX;
    const y = simForm.BeeHaveMapCenterPointY;
    if (!x || !y || !simPanelOpen) return null;
    const lon = (x / 20037508.34) * 180;
    const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((y / 20037508.34) * 180 * Math.PI / 180)) - Math.PI / 2);
    return { coordinates: [lon, lat] };
  }, [simForm.BeeHaveMapCenterPointX, simForm.BeeHaveMapCenterPointY, simPanelOpen]);

  // Build hive markers for the currently selected baseline / scenario runs.
  // These convey "which run's hive" for multi-run scenarios.
  const selectedRunHives = useMemo(() => {
    const markers = [];
    const findRun = (id) => availableRuns.find(r => r.id === id);
    const baseline = baselineRunId != null ? findRun(baselineRunId) : null;
    const scenario = scenarioRunId != null ? findRun(scenarioRunId) : null;
    if (baseline && baseline.hive_lon != null && baseline.hive_lat != null) {
      markers.push({
        coordinates: [baseline.hive_lon, baseline.hive_lat],
        role: 'baseline',
        run: baseline,
      });
    }
    if (scenario && scenario.hive_lon != null && scenario.hive_lat != null) {
      markers.push({
        coordinates: [scenario.hive_lon, scenario.hive_lat],
        role: 'scenario',
        run: scenario,
      });
    }
    return markers;
  }, [availableRuns, baselineRunId, scenarioRunId]);

  // Hive markers for all view-selected runs, shown when the Beehive layer is toggled on.
  const viewRunHives = useMemo(() => {
    if (!layerVisibility.Beehive?.visible) return [];
    const grouped = new globalThis.Map();
    viewRunIds
      .map(id => availableRuns.find(r => r.id === id))
      .filter(r => r && r.hive_lon != null && r.hive_lat != null)
      .forEach((r) => {
        const role = r.treatment_on ? 'treated' : 'untreated';
        const hiveKey = r.hive_group_id || r.batch_sim_id || r.sim_id;
        const key = `${hiveKey}::${role}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            coordinates: offsetHiveCoordinates([r.hive_lon, r.hive_lat], role),
            role,
            run: r,
            hiveKey,
            selectedRuns: 0,
          });
        }
        grouped.get(key).selectedRuns += 1;
      });
    return Array.from(grouped.values());
  }, [availableRuns, viewRunIds, layerVisibility.Beehive?.visible]);

  const hiveNumberByKey = useMemo(() => {
    const keys = Array.from(new Set(viewRunHives.map((h) => h.hiveKey))).sort((a, b) => a.localeCompare(b));
    const mapping = {};
    keys.forEach((key, idx) => {
      mapping[key] = idx + 1;
    });
    return mapping;
  }, [viewRunHives]);

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

  // Load vegetation mapping data once
  useEffect(() => {
    const loadVegetationMapping = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/features/vegetation-mapping'));
        if (response.ok) {
          const data = await response.json();
          // Convert the new format to a lookup by feature ID
          const featureVegetationMap = {};
          data.feature_vegetation_mappings.forEach(mapping => {
            featureVegetationMap[mapping.feature_id] = {
              vegetation_class: mapping.vegetation_class,
              vegetation_name: mapping.vegetation_name
            };
          });
          setVegetationMapping(featureVegetationMap);
          dispatch(setVegetationCodesMap(featureVegetationMap));
          console.log('Vegetation mapping loaded:', featureVegetationMap);
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

  // Find the first treated run among selected view runs (for applications layer)
  const treatedViewRunId = useMemo(() => {
    for (const id of viewRunIds) {
      const run = availableRuns.find(r => r.id === id);
      if (run && run.treatment_on) return id;
    }
    return scenarioRunId; // fallback to compare-tab selection
  }, [viewRunIds, availableRuns, scenarioRunId]);

  // Load applications data for the active treated run
  useEffect(() => {
    if (treatedViewRunId == null) {
      setApplicationsData([]);
      return;
    }
    const loadApplications = async () => {
      try {
        const data = await loadApplicationsData([], treatedViewRunId);
        setApplicationsData(data);
      } catch (error) {
        console.error('Failed to load applications data:', error);
        setApplicationsData([]);
      }
    };
    loadApplications();
  }, [treatedViewRunId]);

  // Get applications data for selected features (for timeline)
  const selectedApplicationsData = useMemo(() => {
    console.log('🔍 Map: Computing selectedApplicationsData...', { 
      applicationsDataLength: applicationsData?.length || 0,
      selectedFeatureIdsLength: selectedFeatureIds?.length || 0,
      selectedFeatureIds 
    });
    if (!applicationsData || selectedFeatureIds.length === 0) return [];
    const filtered = applicationsData.filter(app => selectedFeatureIds.includes(app.lulc_feature_id));
    console.log('🔍 Map: Filtered applications for selected features:', filtered.length, 'records');
    return filtered;
  }, [applicationsData, selectedFeatureIds]);

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

  // Keyboard shortcut for debug mode (Ctrl/Cmd + D)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        setDebugMode(prev => {
          const newMode = !prev;
          console.log(`🐛 Debug mode ${newMode ? 'ENABLED' : 'DISABLED'} (via Ctrl/Cmd+D) - Click on features to see detailed information in console`);
          return newMode;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Note: Bee population data has no spatial resolution - it represents colony-wide metrics
  // that are the same for all polygons. Therefore, bee population data is only displayed
  // in time series charts, not as map layers.

  // Get unique feature IDs that have applications
  const featuresWithApplications = useMemo(() => {
    console.log('🔍 Map: Computing featuresWithApplications...', { 
      applicationsDataLength: applicationsData?.length || 0 
    });
    if (!applicationsData || applicationsData.length === 0) {
      console.log('🔍 Map: No applications data, returning empty set');
      return new Set();
    }
    const uniqueFeatureIds = new Set(applicationsData.map(app => app.lulc_feature_id));
    console.log('🔍 Map: Features with applications:', uniqueFeatureIds.size, 'unique features');
    console.log('🔍 Map: Sample feature IDs:', Array.from(uniqueFeatureIds).slice(0, 10));
    return uniqueFeatureIds;
  }, [applicationsData]);

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

  // Enhanced click handler with comprehensive debugging
  const handleFeatureClick = useCallback(async (info) => {
    // If hive placement mode is active, place hive instead of selecting feature
    if (hivePlacementMode) {
      const [lng, lat] = info.coordinate || [];
      if (lng != null && lat != null) {
        const x = lng * 20037508.34 / 180;
        const latRad = lat * Math.PI / 180;
        const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * 20037508.34 / Math.PI;
        dispatch(setHivePosition({
          x: Math.round(x * 10000) / 10000,
          y: Math.round(y * 10000) / 10000,
        }));
      }
      return;
    }
    if (info.object) {
      const featureId = info.object.id;
      dispatch(selectFeature(featureId));
      
      // 🐛 DEBUG: Only show debug info when debug mode is enabled
      if (debugMode) {
        console.group(`🐛 DEBUG: Selected Feature ${featureId}`);
        
        // Basic feature info
        console.log('📍 Feature Object:', info.object);
        console.log('🗺️  Feature Properties:', info.object.properties);
        console.log('📐 Geometry Type:', info.object.geometry?.type);
        console.log('🎯 Click Coordinates:', info.coordinate);
        
        // Current UI state
        console.log('⏰ Selected Time Point:', selectedTimePoint);
        console.log('👁️  Layer Visibility:', layerVisibility);
        console.log('🔍 Active Filters:', activeFilters);
        console.log('📋 All Selected Features:', selectedFeatureIds);
        
        // Data availability
        console.log('📊 Data Availability:');
        console.log('  - GeoJSON Data:', !!geoJsonData);
        console.log('  - Nectar Max Data:', !!nectarMax);
        console.log('  - Pollen Max Data:', !!pollenMax);
        console.log('  - Bee Population Data:', !!beePopulationData);
        console.log('  - Vegetation Mapping:', !!vegetationMapping);
        
        // Try to fetch detailed data for this feature
        try {
          console.log('🔄 Fetching detailed data for feature...');
          
          // Get nectar timeseries if available
          try {
            const nectarResponse = await fetch(buildApiUrl(`/nectar/timeseries/${featureId}`));
            if (nectarResponse.ok) {
              const nectarData = await nectarResponse.json();
              console.log('🌺 Nectar Timeseries:', nectarData.nectar_timeseries?.slice(0, 10), '... (first 10 values)');
              console.log('🌺 Nectar Stats:', {
                length: nectarData.nectar_timeseries?.length,
                min: Math.min(...(nectarData.nectar_timeseries || [])),
                max: Math.max(...(nectarData.nectar_timeseries || [])),
                avg: (nectarData.nectar_timeseries || []).reduce((a, b) => a + b, 0) / (nectarData.nectar_timeseries?.length || 1)
              });
            } else {
              console.warn('⚠️  No nectar data available for feature');
            }
          } catch (err) {
            console.warn('⚠️  Error fetching nectar data:', err.message);
          }
          
          // Get pollen timeseries if available
          try {
            const pollenResponse = await fetch(buildApiUrl(`/pollen/timeseries/${featureId}`));
            if (pollenResponse.ok) {
              const pollenData = await pollenResponse.json();
              console.log('🌻 Pollen Timeseries:', pollenData.pollen_timeseries?.slice(0, 10), '... (first 10 values)');
              console.log('🌻 Pollen Stats:', {
                length: pollenData.pollen_timeseries?.length,
                min: Math.min(...(pollenData.pollen_timeseries || [])),
                max: Math.max(...(pollenData.pollen_timeseries || [])),
                avg: (pollenData.pollen_timeseries || []).reduce((a, b) => a + b, 0) / (pollenData.pollen_timeseries?.length || 1)
              });
            } else {
              console.warn('⚠️  No pollen data available for feature');
            }
          } catch (err) {
            console.warn('⚠️  Error fetching pollen data:', err.message);
          }
          
          // Get vegetation info if available
          try {
            const vegetationResponse = await fetch(buildApiUrl(`/api/vegetation/feature/${featureId}`));
            if (vegetationResponse.ok) {
              const vegetationData = await vegetationResponse.json();
              console.log('🌿 Vegetation Data:', vegetationData);
            } else {
              console.warn('⚠️  No vegetation data available for feature');
            }
          } catch (err) {
            console.warn('⚠️  Error fetching vegetation data:', err.message);
          }
          
        } catch (err) {
          console.error('❌ Error fetching detailed feature data:', err);
        }
        
        console.groupEnd();
      }
    }
  }, [dispatch, debugMode, selectedTimePoint, layerVisibility, activeFilters, selectedFeatureIds, geoJsonData, nectarMax, pollenMax, beePopulationData, vegetationMapping, applicationsData, hivePlacementMode]);

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
    // If hive placement mode is active, place hive at click location
    if (hivePlacementMode) {
      const [lng, lat] = info.coordinate || [];
      if (lng != null && lat != null) {
        // Convert WGS84 to Web Mercator (EPSG:3857)
        const x = lng * 20037508.34 / 180;
        const latRad = lat * Math.PI / 180;
        const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * 20037508.34 / Math.PI;
        dispatch(setHivePosition({
          x: Math.round(x * 10000) / 10000,
          y: Math.round(y * 10000) / 10000,
        }));
      }
      return;
    }
    // If no object was clicked (clicking on background), clear the selection
    if (!info.object) {
      dispatch(clearSelection());
    }
  }, [dispatch, hivePlacementMode]);

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
          const featureId = feature.id;

          if (!featureId || !vegetationMapping || !vegetationMapping[featureId]) {
            const baseColor = [200, 200, 200, 255]; // Gray for missing mapping
            return getHighlightedFillColor(feature, baseColor);
          }

          const vegetationInfo = vegetationMapping[featureId];
          const vegetationType = vegetationInfo.vegetation_name;

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
    // Applications layer - shows features with plant protection product applications
    (() => {
      const shouldRender = layerVisibility.Applications?.visible && 
                           filteredGeoJsonData &&
                           featuresWithApplications.size > 0;
      console.log('🎨 Map: Applications layer rendering decision:', {
        layerVisible: layerVisibility.Applications?.visible,
        hasGeoJsonData: !!filteredGeoJsonData,
        featuresWithApplicationsCount: featuresWithApplications.size,
        shouldRender
      });
      
      if (!shouldRender) {
        console.log('🎨 Map: Skipping applications layer rendering');
        return null;
      }

      const applicationsFeatures = filteredGeoJsonData.features.filter(feature => featuresWithApplications.has(feature.id));
      console.log('🎨 Map: Applications layer features:', applicationsFeatures.length, 'features to render');
      console.log('🎨 Map: Debugging feature ID mismatch...');
      console.log('🎨 Map: Sample GeoJSON feature IDs:', filteredGeoJsonData.features.slice(0, 5).map(f => f.id));
      console.log('🎨 Map: Sample application feature IDs:', Array.from(featuresWithApplications).slice(0, 5));
      console.log('🎨 Map: GeoJSON feature properties sample:', filteredGeoJsonData.features[0]?.properties);
      
      return new GeoJsonLayer({ 
        id: 'applications-layer',
        data: applicationsFeatures,
        filled: true,
        getFillColor: (feature) => {
          // Semi-transparent orange overlay to indicate applications
          // Use low opacity so underlying layers remain visible
          const baseColor = [255, 107, 53, 80]; // Orange with 31% opacity (80/255)
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
          getFillColor: [featuresWithApplications, layerVisibility.Applications.visible, selectedFeatureIds],
          getLineColor: [selectedFeatureIds],
          getLineWidth: [selectedFeatureIds]
        },
        wireframe: false,
      });
    })(), // Close the IIFE
    // Selected-runs hive markers (baseline = blue, scenario = red).
    // Always rendered when runs are selected, independent of the legacy Beehive layer toggle.
    selectedRunHives.length > 0 &&
      new ScatterplotLayer({
        id: 'selected-runs-hive-layer',
        data: selectedRunHives,
        getPosition: d => d.coordinates,
        getRadius: hiveMarkerRadius,
        getFillColor: d => d.role === 'baseline' ? [37, 99, 235, 220] : [220, 38, 38, 220],
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        stroked: true,
        filled: true,
        radiusUnits: 'pixels',
        lineWidthUnits: 'pixels',
        pickable: true,
        autoHighlight: true,
        updateTriggers: {
          getFillColor: [selectedRunHives],
          getPosition: [selectedRunHives],
          getRadius: [hiveMarkerRadius],
        },
      }),
    // View-run hive markers: shown for all runs selected in the ViewRunsPicker when
    // the Beehive Location layer is enabled. Treated = orange, untreated = teal.
    viewRunHives.length > 0 &&
      new ScatterplotLayer({
        id: 'view-runs-hive-layer',
        data: viewRunHives,
        getPosition: d => d.coordinates,
        getRadius: hiveMarkerRadius,
        getFillColor: d => d.role === 'treated' ? [234, 88, 12, 220] : [13, 148, 136, 220],
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        stroked: true,
        filled: true,
        radiusUnits: 'pixels',
        lineWidthUnits: 'pixels',
        pickable: true,
        onHover: (info) => {
          if (!info.object) {
            setHiveHoverInfo(null);
            return;
          }
          const obj = info.object;
          const hiveNumber = hiveNumberByKey[obj.hiveKey] || '?';
          setHiveHoverInfo({
            x: info.x,
            y: info.y,
            hiveNumber,
            hiveKey: obj.hiveKey,
            role: obj.role,
            selectedRuns: obj.selectedRuns,
          });
        },
        autoHighlight: true,
        updateTriggers: {
          getFillColor: [viewRunHives],
          getPosition: [viewRunHives],
          getRadius: [hiveMarkerRadius],
          onHover: [hiveNumberByKey],
        },
      }),
    viewRunHives.length > 0 &&
      new TextLayer({
        id: 'view-runs-hive-label-layer',
        data: viewRunHives,
        getPosition: d => d.coordinates,
        getText: d => String(hiveNumberByKey[d.hiveKey] || ''),
        getColor: d => d.role === 'treated' ? [234, 88, 12, 255] : [13, 148, 136, 255],
        getSize: 13,
        sizeUnits: 'pixels',
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        billboard: true,
        fontWeight: 800,
        pickable: false,
        updateTriggers: {
          getText: [hiveNumberByKey],
          getColor: [viewRunHives],
          getPosition: [viewRunHives],
        },
      }),

    // Simulation hive placement: 5km foraging radius circle
    simHiveMarker &&
      new ScatterplotLayer({
        id: 'sim-hive-radius-layer',
        data: [simHiveMarker],
        getPosition: d => d.coordinates,
        getRadius: 5000,
        radiusUnits: 'meters',
        filled: true,
        stroked: true,
        getFillColor: [37, 99, 235, 25],
        getLineColor: [37, 99, 235, 180],
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        pickable: false,
      }),

    // Simulation hive placement: hive marker dot
    simHiveMarker &&
      new ScatterplotLayer({
        id: 'sim-hive-marker-layer',
        data: [simHiveMarker],
        getPosition: d => d.coordinates,
        getRadius: 8,
        radiusUnits: 'pixels',
        filled: true,
        stroked: true,
        getFillColor: [37, 99, 235, 220],
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        pickable: false,
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
    <div style={{ position: 'relative', width: '100%', height: '100%', cursor: hivePlacementMode ? 'crosshair' : undefined }}>
      {hivePlacementMode && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, background: '#2563eb', color: '#fff', padding: '6px 14px',
          borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          🎯 Click to place beehive
        </div>
      )}
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
      
      {hiveHoverInfo && (
        <div
          style={{
            position: 'absolute',
            left: hiveHoverInfo.x + 10,
            top: hiveHoverInfo.y + 10,
            background: 'rgba(17, 24, 39, 0.92)',
            color: '#f9fafb',
            borderRadius: '6px',
            padding: '6px 8px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1200,
            maxWidth: '240px',
          }}
        >
          <div style={{ fontWeight: 700 }}>Hive #{hiveHoverInfo.hiveNumber}</div>
          <div>{hiveHoverInfo.hiveKey}</div>
          <div>{hiveHoverInfo.role} · {hiveHoverInfo.selectedRuns} selected MC run{hiveHoverInfo.selectedRuns === 1 ? '' : 's'}</div>
        </div>
      )}
    </div>
  );
}

export default Map;
