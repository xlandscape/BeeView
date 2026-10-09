import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setLandUseData, setNectarMax, setBeePopulationMetrics, setVegetationCodesMap } from '../../store/slices/mapSlice';
import {Map as MapLibre, NavigationControl, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {GeoJsonLayer, ScatterplotLayer, TextLayer} from '@deck.gl/layers';
import {DataFilterExtension} from '@deck.gl/extensions';
import { getLandUseColor, getNectarColor, getPollenColor, getVegetationColor } from '../../utils/colorScales';
import 'maplibre-gl/dist/maplibre-gl.css';
import { selectFeature, clearSelection } from '../../store/reducers/selectionReducer';
import { setHivePosition } from '../../store/slices/simulationSlice';
import { loadViewportData, loadTimePointData, loadBeePopulationMetrics, debounce, getViewportConfig, setViewportConfig } from '../../utils/viewportLoader';
import { fetchApplications, applicationsRequestKey } from '../../store/thunks/exposureThunks';
import { buildApiUrl } from '../../config/api';

// Disable viewport queries (for debugging)
// Only enable this if you know what you are doing, as viewport queries
// will restrict the data that is loaded to the current viewport and will
// have the side effect that all statistical graphs will adapt accordingly
setViewportConfig({ USE_VIEWPORT_QUERIES: false,
  ENABLE_CACHING: true  // Enable caching to prevent redundant API calls
 });

const EMPTY_APPLICATIONS = [];

const INITIAL_VIEW_STATE = {
  latitude: 44.029,
  longitude: 1.135,
  zoom: 10,
  bearing: 0,
  pitch: 0
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const GRAY = [200, 200, 200];
const APPLICATION_ORANGE = [255, 107, 53];
const LINE_RGB = [50, 50, 50];

// One shared extension instance so layer props stay referentially stable.
const L1_FILTER_EXTENSION = new DataFilterExtension({ filterSize: 1 });

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

// WGS84 -> Web Mercator (EPSG:3857), rounded to 4 decimals for the simulation form.
function toWebMercator(lng, lat) {
  const x = lng * 20037508.34 / 180;
  const latRad = lat * Math.PI / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * 20037508.34 / Math.PI;
  return { x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000 };
}

// The full GeoJSON (with geometry) stays inside this component. Other parts
// of the UI only need ids and properties, so that is all we put in Redux:
// it keeps the store small and avoids Immer freezing 2.6M coordinates.
function toLightFeatureCollection(geoJson) {
  return {
    type: 'FeatureCollection',
    features: geoJson.features.map((f) => ({ type: 'Feature', id: f.id, properties: f.properties })),
  };
}

function DeckGLOverlay(props) {
  const overlay = useControl(() => new DeckOverlay(props));
  useEffect(() => {
    overlay.setProps(props);
  });
  return null;
}

function Map() {
  const dispatch = useDispatch();
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [nectarMax, setNectarData] = useState(null);
  const [pollenMax, setPollenData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [vegetationMapping, setVegetationMapping] = useState(null);
  const [debugMode, setDebugMode] = useState(false); // 🐛 Debug mode toggle
  const [hiveHoverInfo, setHiveHoverInfo] = useState(null);
  // The map view lives in a ref: re-rendering React on every mouse move is
  // wasted work because deck.gl/maplibre already own the camera. Only the
  // zoom-dependent marker radius is React state, and it changes rarely.
  const viewStateRef = useRef(INITIAL_VIEW_STATE);
  const lastZoomRef = useRef(INITIAL_VIEW_STATE.zoom);
  const [hiveMarkerRadius, setHiveMarkerRadius] = useState(() => getHiveMarkerRadiusPixels(INITIAL_VIEW_STATE.zoom));
  const lastProcessedTimePoint = useRef(null);

  const activeFilters = useSelector((state) => state.map.activeL1Filters);
  const lulcVisible = useSelector((state) => state.layers.LULC?.visible);
  const nectarVisible = useSelector((state) => state.layers.Nectar?.visible);
  const pollenVisible = useSelector((state) => state.layers.Pollen?.visible);
  const vegetationVisible = useSelector((state) => state.layers.Vegetation?.visible);
  const applicationsVisible = useSelector((state) => state.layers.Applications?.visible);
  const beehiveVisible = useSelector((state) => state.layers.Beehive?.visible);
  const selectedTimePoint = useSelector((state) => state.time.selectedTimePoint);
  const selectedFeatureIds = useSelector((state) => state.selection.selectedFeatureIds);
  const availableRuns = useSelector((state) => state.runs.availableRuns);
  const baselineRunId = useSelector((state) => state.runs.baselineRunId);
  const scenarioRunId = useSelector((state) => state.runs.scenarioRunId);
  const viewRunIds = useSelector((state) => state.runs.viewRunIds);
  const hivePlacementMode = useSelector((state) => state.simulation.hivePlacementMode);
  const simPanelOpen = useSelector((state) => state.simulation.panelOpen);
  const simHiveX = useSelector((state) => state.simulation.form.BeeHaveMapCenterPointX);
  const simHiveY = useSelector((state) => state.simulation.form.BeeHaveMapCenterPointY);

  // Compute simulation hive marker position (WGS84) from form coordinates (EPSG:3857)
  const simHiveMarker = useMemo(() => {
    if (!simHiveX || !simHiveY || !simPanelOpen) return null;
    const lon = (simHiveX / 20037508.34) * 180;
    const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((simHiveY / 20037508.34) * 180 * Math.PI / 180)) - Math.PI / 2);
    return { coordinates: [lon, lat] };
  }, [simHiveX, simHiveY, simPanelOpen]);

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
    if (!beehiveVisible) return [];
    const runsById = new globalThis.Map(availableRuns.map((r) => [r.id, r]));
    const grouped = new globalThis.Map();
    viewRunIds
      .map(id => runsById.get(id))
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
  }, [availableRuns, viewRunIds, beehiveVisible]);

  const hiveNumberByKey = useMemo(() => {
    const keys = Array.from(new Set(viewRunHives.map((h) => h.hiveKey))).sort((a, b) => a.localeCompare(b));
    const mapping = {};
    keys.forEach((key, idx) => {
      mapping[key] = idx + 1;
    });
    return mapping;
  }, [viewRunHives]);

  // ---------------------------------------------------------------- loading
  const applyViewportData = useCallback((data) => {
    setGeoJsonData(data.geoJson);
    setNectarData(data.nectar);
    setPollenData(data.pollen);
    dispatch(setLandUseData(toLightFeatureCollection(data.geoJson)));
    dispatch(setNectarMax(data.nectar));
  }, [dispatch]);

  const loadAndApplyViewportData = useCallback(async (currentViewState) => {
    if (!currentViewState) return;
    setLoading(true);
    setError(null);
    try {
      applyViewportData(await loadViewportData(currentViewState));
    } catch (err) {
      console.error('Error loading viewport data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [applyViewportData]);

  // Debounced variant, only used when viewport queries are enabled.
  const debouncedLoadViewportData = useMemo(
    () => debounce((currentViewState) => loadAndApplyViewportData(currentViewState), 1500),
    [loadAndApplyViewportData]
  );

  const loadAndApplyTimePointData = useCallback(async (timePoint) => {
    if (!timePoint) return;
    setLoading(true);
    setError(null);
    try {
      const timeData = await loadTimePointData(viewStateRef.current, timePoint);
      // Ignore responses that arrive after the user moved on to another day.
      if (lastProcessedTimePoint.current !== timePoint) return;
      setNectarData(timeData.nectar);
      setPollenData(timeData.pollen);
      dispatch(setNectarMax(timeData.nectar));
    } catch (err) {
      console.error('Error loading time-specific data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  const debouncedLoadTimePointData = useMemo(
    () => debounce((timePoint) => loadAndApplyTimePointData(timePoint), 800),
    [loadAndApplyTimePointData]
  );

  // Load initial data once (GeoJSON + max values). No debounce: nothing to coalesce on mount.
  useEffect(() => {
    loadAndApplyViewportData(INITIAL_VIEW_STATE);
  }, [loadAndApplyViewportData]);

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
        } else {
          console.warn('Vegetation mapping not found');
        }
      } catch (error) {
        console.error('Error loading vegetation mapping:', error);
      }
    };

    loadVegetationMapping();
  }, [dispatch]);

  // Load time-specific data when selected time point changes. With the full
  // dataset, day values come from the in-memory forage matrices, so apply
  // immediately; viewport mode still debounces its per-day requests.
  useEffect(() => {
    if (!selectedTimePoint || selectedTimePoint === lastProcessedTimePoint.current) {
      return;
    }
    lastProcessedTimePoint.current = selectedTimePoint;
    if (!getViewportConfig().USE_VIEWPORT_QUERIES) {
      loadAndApplyTimePointData(selectedTimePoint);
    } else {
      debouncedLoadTimePointData(selectedTimePoint);
    }
  }, [selectedTimePoint, loadAndApplyTimePointData, debouncedLoadTimePointData]);

  // Note: the per-day bee population fetch that used to live here was removed.
  // Colony metrics have no spatial resolution and nothing on the map reads
  // them; the charts load their own series. It cost one request per time step.

  // Load bee population metrics on mount. (The full population time series
  // used to be fetched here too, but nothing on the map consumed it; the
  // charts load their own.)
  useEffect(() => {
    const loadBeeMetadata = async () => {
      try {
        dispatch(setBeePopulationMetrics(await loadBeePopulationMetrics()));
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

  // Applications for the active treated run come from the shared exposure
  // store (one unfiltered request per run, also used by the time series
  // charts), so the Map and the charts never fetch the same data twice.
  const applicationsRequest = useSelector((state) =>
    treatedViewRunId == null ? null : state.exposure.requests[applicationsRequestKey(treatedViewRunId)]
  );
  const applicationsData = applicationsRequest?.applications || EMPTY_APPLICATIONS;
  const applicationsStatus = applicationsRequest?.applicationsStatus;
  useEffect(() => {
    if (treatedViewRunId == null) return;
    if (!applicationsStatus || applicationsStatus === 'idle') {
      dispatch(fetchApplications({ runId: treatedViewRunId }));
    }
  }, [treatedViewRunId, applicationsStatus, dispatch]);

  // Handle viewport changes
  const handleViewStateChange = useCallback((evt) => {
    const newViewState = evt.viewState;
    viewStateRef.current = newViewState;
    const radius = getHiveMarkerRadiusPixels(newViewState.zoom);
    setHiveMarkerRadius((prev) => (prev === radius ? prev : radius));

    // Skip loading data if viewport queries are disabled
    if (!getViewportConfig().USE_VIEWPORT_QUERIES) {
      return;
    }

    // Detect if this is primarily a zoom change
    const zoomChange = Math.abs(newViewState.zoom - lastZoomRef.current) > 0.5;
    lastZoomRef.current = newViewState.zoom;

    // Use longer debounce for zoom changes
    if (zoomChange) {
      setTimeout(() => {
        debouncedLoadViewportData(newViewState);
      }, 1000); // Additional 1 second delay for zoom
    } else {
      debouncedLoadViewportData(newViewState);
    }
  }, [debouncedLoadViewportData]);

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
    if (!applicationsData || applicationsData.length === 0) return new Set();
    return new Set(applicationsData.map(app => app.lulc_feature_id));
  }, [applicationsData]);

  // Subset of polygons that received applications (drawn as an overlay).
  const applicationsFeatures = useMemo(() => {
    if (!geoJsonData || featuresWithApplications.size === 0) return [];
    return geoJsonData.features.filter((feature) => featuresWithApplications.has(feature.id));
  }, [geoJsonData, featuresWithApplications]);

  // Snapshot of state for the debug console output, so the click handler
  // does not have to be recreated (and every layer re-diffed) whenever data changes.
  const debugSnapshotRef = useRef(null);
  debugSnapshotRef.current = { selectedTimePoint, activeFilters, selectedFeatureIds, geoJsonData, nectarMax, pollenMax, vegetationMapping };

  // Enhanced click handler with comprehensive debugging
  const handleFeatureClick = useCallback(async (info) => {
    // If hive placement mode is active, place hive instead of selecting feature
    if (hivePlacementMode) {
      const [lng, lat] = info.coordinate || [];
      if (lng != null && lat != null) {
        dispatch(setHivePosition(toWebMercator(lng, lat)));
      }
      return;
    }
    if (info.object) {
      const featureId = info.object.id;
      dispatch(selectFeature(featureId));

      // 🐛 DEBUG: Only show debug info when debug mode is enabled
      if (debugMode) {
        const snap = debugSnapshotRef.current;
        console.group(`🐛 DEBUG: Selected Feature ${featureId}`);

        // Basic feature info
        console.log('📍 Feature Object:', info.object);
        console.log('🗺️  Feature Properties:', info.object.properties);
        console.log('📐 Geometry Type:', info.object.geometry?.type);
        console.log('🎯 Click Coordinates:', info.coordinate);

        // Current UI state
        console.log('⏰ Selected Time Point:', snap.selectedTimePoint);
        console.log('🔍 Active Filters:', snap.activeFilters);
        console.log('📋 All Selected Features:', snap.selectedFeatureIds);

        // Data availability
        console.log('📊 Data Availability:');
        console.log('  - GeoJSON Data:', !!snap.geoJsonData);
        console.log('  - Nectar Max Data:', !!snap.nectarMax);
        console.log('  - Pollen Max Data:', !!snap.pollenMax);
        console.log('  - Vegetation Mapping:', !!snap.vegetationMapping);

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
  }, [dispatch, debugMode, hivePlacementMode]);

  // Handle map background clicks to clear selection
  const handleMapClick = useCallback((info) => {
    // If hive placement mode is active, place hive at click location
    if (hivePlacementMode) {
      const [lng, lat] = info.coordinate || [];
      if (lng != null && lat != null) {
        dispatch(setHivePosition(toWebMercator(lng, lat)));
      }
      return;
    }
    // If no object was clicked (clicking on background), clear the selection
    if (!info.object) {
      dispatch(clearSelection());
    }
  }, [dispatch, hivePlacementMode]);

  // ------------------------------------------------------------ polygon styling
  // Selection membership as a Set: the accessors below run once per feature
  // (25k) on every recolor, so Array.includes would be O(features x selected).
  const selectedSet = useMemo(() => new Set(selectedFeatureIds), [selectedFeatureIds]);
  const hasSelection = selectedFeatureIds.length > 0;
  const activeFilterSet = useMemo(() => new Set(activeFilters), [activeFilters]);

  // Which thematic colouring the landscape polygons use. Previously each mode
  // was its own GeoJsonLayer stacked on top of the others, which tessellated
  // the whole landscape once per visible layer. The topmost visible layer
  // dominated visually, so we render exactly that one.
  const fillMode = useMemo(() => {
    if (vegetationVisible && vegetationMapping) return 'vegetation';
    if (pollenVisible && pollenMax) return 'pollen';
    if (nectarVisible && nectarMax) return 'nectar';
    if (lulcVisible) return 'lulc';
    return null;
  }, [vegetationVisible, vegetationMapping, pollenVisible, pollenMax, nectarVisible, nectarMax, lulcVisible]);

  const getSelectionAlpha = useCallback((featureId) => {
    if (!hasSelection) return 200; // Default opacity when nothing is selected
    return selectedSet.has(featureId) ? 255 : 80; // Selected: full opacity, others: very dimmed
  }, [hasSelection, selectedSet]);

  const getFillColor = useCallback((feature) => {
    let base;
    switch (fillMode) {
      case 'vegetation': {
        const vegetationType = vegetationMapping[feature.id]?.vegetation_name;
        base = vegetationType ? getVegetationColor(vegetationType) : GRAY;
        break;
      }
      case 'pollen': {
        const value = pollenMax[feature.id];
        base = value ? getPollenColor(value) : GRAY;
        break;
      }
      case 'nectar': {
        const value = nectarMax[feature.id];
        base = value ? getNectarColor(value) : GRAY;
        break;
      }
      default:
        base = getLandUseColor(feature.properties.L3_label, 3);
    }
    return [base[0], base[1], base[2], getSelectionAlpha(feature.id)];
  }, [fillMode, vegetationMapping, pollenMax, nectarMax, getSelectionAlpha]);

  const getApplicationFillColor = useCallback(
    (feature) => [APPLICATION_ORANGE[0], APPLICATION_ORANGE[1], APPLICATION_ORANGE[2], getSelectionAlpha(feature.id)],
    [getSelectionAlpha]
  );

  const getLineColor = useCallback((feature) => {
    if (!hasSelection) return [LINE_RGB[0], LINE_RGB[1], LINE_RGB[2], 100];
    return [LINE_RGB[0], LINE_RGB[1], LINE_RGB[2], selectedSet.has(feature.id) ? 200 : 50];
  }, [hasSelection, selectedSet]);

  // L1 land-use filters are applied on the GPU via DataFilterExtension, so
  // toggling a filter neither rebuilds the data array nor re-tessellates.
  const getFilterValue = useCallback(
    (feature) => (activeFilterSet.size === 0 || activeFilterSet.has(feature.properties.L1_label) ? 1 : 0),
    [activeFilterSet]
  );

  const landscapeFeatures = geoJsonData ? geoJsonData.features : null;

  const layers = useMemo(() => [
    fillMode &&
    landscapeFeatures &&
      new GeoJsonLayer({
        id: 'landscape-layer',
        data: landscapeFeatures,
        filled: true,
        stroked: true,
        getFillColor,
        getLineColor,
        getLineWidth: 1,
        lineWidthMinPixels: 1,
        pickable: true,
        autoHighlight: true,
        onClick: handleFeatureClick,
        extensions: [L1_FILTER_EXTENSION],
        getFilterValue,
        filterRange: [1, 1],
        updateTriggers: {
          getFillColor: [getFillColor],
          getLineColor: [getLineColor],
          getFilterValue: [getFilterValue],
        },
      }),
    // Applications overlay - features with plant protection product applications
    applicationsVisible &&
    applicationsFeatures.length > 0 &&
      new GeoJsonLayer({
        id: 'applications-layer',
        data: applicationsFeatures,
        filled: true,
        stroked: true,
        getFillColor: getApplicationFillColor,
        getLineColor,
        getLineWidth: 1,
        lineWidthMinPixels: 1,
        pickable: true,
        autoHighlight: true,
        onClick: handleFeatureClick,
        extensions: [L1_FILTER_EXTENSION],
        getFilterValue,
        filterRange: [1, 1],
        updateTriggers: {
          getFillColor: [getApplicationFillColor],
          getLineColor: [getLineColor],
          getFilterValue: [getFilterValue],
        },
      }),
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
  ].filter(Boolean), [
    fillMode, landscapeFeatures, getFillColor, getLineColor, getFilterValue, handleFeatureClick,
    applicationsVisible, applicationsFeatures, getApplicationFillColor,
    selectedRunHives, viewRunHives, hiveNumberByKey, hiveMarkerRadius, simHiveMarker,
  ]);

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
          {geoJsonData ? 'Loading...' : 'Loading landscape...'}
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
