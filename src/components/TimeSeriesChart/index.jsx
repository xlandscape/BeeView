import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedTimePoint, setAvailableTimePoints } from '../../store/timeSlice';
import { clearSelection } from '../../store/reducers/selectionReducer';
import { loadBeePopulationTimeSeries } from '../../utils/viewportLoader';
import { buildApiUrl } from '../../config/api';
import { RUN_COLOR_PALETTE } from '../../store/slices/runsSlice';
import {
  buildExposureRequestKey,
  fetchApplications,
  fetchExposureTimeseries,
} from '../../store/thunks/exposureThunks';
import TrellisTimeSeriesChart from '../TrellisTimeSeriesChart';
import CompareChart from '../CompareChart';

const DERIVED_BEE_METRICS = {
  'TotalIHbees + TotalForagers + TotalDroneEggs + TotalEggs + TotalDroneLarvae + TotalLarvae + TotalDronePupae + TotalPupae': [
    'TotalIHbees',
    'TotalForagers',
    'TotalDroneEggs',
    'TotalEggs',
    'TotalDroneLarvae',
    'TotalLarvae',
    'TotalDronePupae',
    'TotalPupae',
  ],
  'TotalIHbees + TotalForagers': ['TotalIHbees', 'TotalForagers'],
  'TotalDroneEggs + TotalEggs': ['TotalDroneEggs', 'TotalEggs'],
  'TotalDroneLarvae + TotalLarvae': ['TotalDroneLarvae', 'TotalLarvae'],
  'TotalDronePupae + TotalPupae': ['TotalDronePupae', 'TotalPupae'],
};

function valueForBeeMetric(dayData, metricKey) {
  if (typeof dayData?.[metricKey] === 'number') {
    return dayData[metricKey];
  }

  const formula = DERIVED_BEE_METRICS[metricKey];
  if (!formula) return 0;

  const hasAllInputs = formula.every((name) => typeof dayData?.[name] === 'number');
  if (!hasAllInputs) return 0;
  return formula.reduce((sum, name) => sum + dayData[name], 0);
}

const TimeSeriesChart = ({ activeTab = 'nectar-pollen' }) => {
  const dispatch = useDispatch();
  const [averageData, setAverageData] = useState([]);
  const [beePopulationData, setBeePopulationData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [beeLineScope, setBeeLineScope] = useState('mc');
  const [exposureLineScope, setExposureLineScope] = useState('mc');
  // Per-run replicate aggregates: { [runId]: { metrics: { [name]: {days, mean, ...} } } }
  const [runReplicateData, setRunReplicateData] = useState({});

  const { selectedTimePoint } = useSelector(state => state.time);
  const selectedFeatureIds = useSelector(state => state.selection.selectedFeatureIds);
  const layers = useSelector(state => state.layers);
  const viewRunIds = useSelector(state => state.runs.viewRunIds);
  const availableRuns = useSelector(state => state.runs.availableRuns);
  const exposureRequests = useSelector(state => state.exposure.requests);
  const dayCount = Math.max(
    averageData?.length || 0,
    beePopulationData?.timeseries?.length || 0,
    365,
  );
  const effectiveRunIds = viewRunIds.length > 0 ? viewRunIds : [null];
  const exposureRunIds = viewRunIds.length > 0 ? viewRunIds : [];

  const fetchAverageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let url = buildApiUrl('/api/timeseries/averages?include_nectar=true&include_pollen=true');
      
      // If features are selected, add them to the query
      if (selectedFeatureIds.length > 0) {
        const featureIdsStr = selectedFeatureIds.join(',');
        url += `&feature_ids=${featureIdsStr}`;
      }
      // If no features selected, the API will return average across ALL features
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setAverageData(data.averages || []);
      
      // Set available time points using the current data horizon.
      const inferredDays = Math.max(data?.averages?.length || 0, 365);
      const timePoints = Array.from({ length: inferredDays }, (_, i) => i + 1);
      dispatch(setAvailableTimePoints(timePoints));
      
    } catch (err) {
      setError(err.message);
      console.error('Error fetching average time series data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFeatureIds, dispatch]);

  const fetchBeePopulationData = useCallback(async () => {
    try {
      const data = await loadBeePopulationTimeSeries();
      setBeePopulationData(data);
    } catch (err) {
      console.error('Error fetching bee population data:', err);
      setBeePopulationData(null);
    }
  }, []);

  // Per-run replicate fetch: pull /api/bee-population/replicates for each viewRunId.
  // Cached in `runReplicateData` keyed by runId so flipping a chip on/off doesn't refetch.
  useEffect(() => {
    if (!viewRunIds || viewRunIds.length === 0) return;
    const missing = viewRunIds.filter(id => !runReplicateData[id]);
    if (missing.length === 0) return;
    const controller = new AbortController();
    Promise.all(
      missing.map(id =>
        fetch(buildApiUrl(`/api/bee-population/replicates?run_id=${id}`), {
          signal: controller.signal,
        })
          .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status} for run ${id}`);
            return r.json();
          })
          .then(json => ({ id, json }))
      )
    )
      .then(results => {
        setRunReplicateData(prev => {
          const next = { ...prev };
          for (const { id, json } of results) next[id] = json;
          return next;
        });
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Error fetching per-run replicate data:', err);
        }
      });
    return () => controller.abort();
  }, [viewRunIds, runReplicateData]);

  // Build a `lines` array (TrellisTimeSeriesChart multi-line format) from per-run
  // replicate data for one metric. One line per selected run, mean across replicates.
  const getMultiRunLines = useCallback((metricName) => {
    if (!viewRunIds || viewRunIds.length === 0) return null;
    const lines = [];
    viewRunIds.forEach((runId, idx) => {
      const runData = runReplicateData[runId];
      const metric = runData?.metrics?.[metricName];
      if (!metric || !metric.days || !metric.mean) return;
      const data = metric.days.map((day, i) => ({ day, value: metric.mean[i] ?? 0 }));
      const run = availableRuns.find(r => r.id === runId);
      const label = run ? (run.label || run.sim_id) : `run ${runId}`;
      lines.push({
        data,
        dataKey: 'value',
        color: RUN_COLOR_PALETTE[idx % RUN_COLOR_PALETTE.length],
        label,
      });
    });
    return lines.length > 0 ? lines : null;
  }, [viewRunIds, runReplicateData, availableRuns]);

  // Aggregate MC runs first, then draw one line per hive group.
  const getHiveMeanLines = useCallback((metricName) => {
    if (!viewRunIds || viewRunIds.length === 0) return null;

    const grouped = new Map();
    viewRunIds.forEach((runId) => {
      const run = availableRuns.find((r) => r.id === runId);
      const metric = runReplicateData[runId]?.metrics?.[metricName];
      if (!metric || !metric.days || !metric.mean) return;

      // Keep treated/untreated separate when averaging MC runs.
      const hiveKey = run?.batch_sim_id || run?.hive_group_id || run?.sim_id || `run ${runId}`;
      if (!grouped.has(hiveKey)) grouped.set(hiveKey, []);
      grouped.get(hiveKey).push({
        days: metric.days,
        mean: metric.mean,
      });
    });

    const lines = [];
    Array.from(grouped.entries()).forEach(([hiveKey, seriesList], idx) => {
      if (!seriesList || seriesList.length === 0) return;

      const n = Math.min(...seriesList.map((s) => Math.min(s.days.length, s.mean.length)));
      if (!Number.isFinite(n) || n <= 0) return;

      const data = [];
      for (let i = 0; i < n; i += 1) {
        let sum = 0;
        let count = 0;
        seriesList.forEach((s) => {
          const v = s.mean[i];
          if (Number.isFinite(v)) {
            sum += v;
            count += 1;
          }
        });
        data.push({
          day: seriesList[0].days[i] ?? (i + 1),
          value: count > 0 ? (sum / count) : 0,
        });
      }

      lines.push({
        data,
        dataKey: 'value',
        color: RUN_COLOR_PALETTE[idx % RUN_COLOR_PALETTE.length],
        label: seriesList.length > 1 ? `${hiveKey} (${seriesList.length} MC)` : `${hiveKey}`,
      });
    });

    return lines.length > 0 ? lines : null;
  }, [viewRunIds, runReplicateData, availableRuns]);

  const getRunLabel = useCallback((runId) => {
    if (runId == null) return 'Default scenario';
    const run = availableRuns.find(item => item.id === runId);
    return run ? (run.label || run.sim_id) : `run ${runId}`;
  }, [availableRuns]);

  const getExposureRequest = useCallback((runId) => {
    const requestKey = buildExposureRequestKey(runId, selectedFeatureIds);
    return exposureRequests[requestKey] || null;
  }, [exposureRequests, selectedFeatureIds]);

  const getExposureLines = useCallback((metricName) => {
    const lines = exposureRunIds
      .map((runId, idx) => {
        const request = getExposureRequest(runId);
        const data = request?.exposureTimeseries || [];
        if (data.length === 0) return null;
        return {
          data,
          dataKey: metricName,
          color: RUN_COLOR_PALETTE[idx % RUN_COLOR_PALETTE.length],
          label: getRunLabel(runId),
        };
      })
      .filter(Boolean);

    return lines.length > 0 ? lines : null;
  }, [exposureRunIds, getExposureRequest, getRunLabel]);

  const getExposureHiveMeanLines = useCallback((metricName) => {
    if (!exposureRunIds || exposureRunIds.length === 0) return null;

    const grouped = new Map();
    exposureRunIds.forEach((runId) => {
      const run = availableRuns.find((r) => r.id === runId);
      const request = getExposureRequest(runId);
      const timeseries = request?.exposureTimeseries || [];
      if (!timeseries || timeseries.length === 0) return;

      // Keep treated/untreated separate while averaging MC runs.
      const hiveKey = run?.batch_sim_id || run?.hive_group_id || run?.sim_id || `run ${runId}`;
      if (!grouped.has(hiveKey)) grouped.set(hiveKey, []);
      grouped.get(hiveKey).push(timeseries);
    });

    const lines = [];
    Array.from(grouped.entries()).forEach(([hiveKey, seriesList], idx) => {
      if (!seriesList || seriesList.length === 0) return;

      const n = Math.min(...seriesList.map((series) => series.length));
      if (!Number.isFinite(n) || n <= 0) return;

      const data = [];
      for (let i = 0; i < n; i += 1) {
        let sum = 0;
        let count = 0;
        seriesList.forEach((series) => {
          const value = series[i]?.[metricName];
          if (Number.isFinite(value)) {
            sum += value;
            count += 1;
          }
        });

        data.push({
          day: seriesList[0][i]?.day ?? (i + 1),
          value: count > 0 ? (sum / count) : 0,
        });
      }

      lines.push({
        data,
        dataKey: 'value',
        color: RUN_COLOR_PALETTE[idx % RUN_COLOR_PALETTE.length],
        label: seriesList.length > 1 ? `${hiveKey} (${seriesList.length} MC)` : `${hiveKey}`,
      });
    });

    return lines.length > 0 ? lines : null;
  }, [exposureRunIds, availableRuns, getExposureRequest]);

  const getApplicationTimelineData = useCallback(() => {
    return effectiveRunIds.flatMap((runId, idx) => {
      const request = getExposureRequest(runId);
      const applications = request?.applications || [];
      const color = RUN_COLOR_PALETTE[idx % RUN_COLOR_PALETTE.length];
      const runLabel = getRunLabel(runId);
      return applications.map((application) => ({
        ...application,
        run_id: runId,
        run_label: runLabel,
        color,
      }));
    });
  }, [effectiveRunIds, getExposureRequest, getRunLabel]);

  const applicationTimelineData = getApplicationTimelineData();
  const exposureRequestEntries = effectiveRunIds.map(runId => ({
    runId,
    request: getExposureRequest(runId),
  }));
  const exposureRequestError = exposureRequestEntries
    .map(({ request }) => request?.exposureError || request?.applicationsError)
    .find(Boolean);
  const isExposureLoading = exposureRequestEntries.some(({ request }) =>
    request?.exposureStatus === 'loading' || request?.applicationsStatus === 'loading'
  );

  // Transform bee population data to chart format
  const getBeeChartData = (metricKey) => {
    if (!beePopulationData || !beePopulationData.timeseries || !Array.isArray(beePopulationData.timeseries)) {
      return [];
    }
    
    // The API returns: {"timeseries": [{"day": 1, "totalEggs": 123, ...}, ...]}
    // Transform to chart format: [{day: 1, totalEggs: 123}, ...]
    return beePopulationData.timeseries.map(dayData => {
      let value = valueForBeeMetric(dayData, metricKey);
      
      return {
        day: dayData.day,
        [metricKey]: value
      };
    });
  };

  useEffect(() => {
    if (activeTab === 'compare') return;
    fetchAverageData();
    fetchBeePopulationData();
  }, [activeTab, fetchAverageData, fetchBeePopulationData]);

  useEffect(() => {
    if (activeTab !== 'nectar-pollen' && activeTab !== 'exposure') {
      return;
    }

    if (activeTab === 'exposure' && viewRunIds.length === 0) {
      return;
    }

    effectiveRunIds.forEach((runId) => {
      const request = getExposureRequest(runId);
      if (request?.applicationsStatus !== 'loading' && request?.applicationsStatus !== 'succeeded') {
        dispatch(fetchApplications({ runId, featureIds: selectedFeatureIds }));
      }

      if (
        activeTab === 'exposure' &&
        request?.exposureStatus !== 'loading' &&
        request?.exposureStatus !== 'succeeded'
      ) {
        dispatch(fetchExposureTimeseries({ runId, featureIds: selectedFeatureIds }));
      }
    });
  }, [activeTab, dispatch, effectiveRunIds, getExposureRequest, selectedFeatureIds, viewRunIds.length]);

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!selectedTimePoint) return;
      
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          dispatch(setSelectedTimePoint(Math.max(1, selectedTimePoint - 1)));
          break;
        case 'ArrowRight':
          event.preventDefault();
          dispatch(setSelectedTimePoint(Math.min(dayCount, selectedTimePoint + 1)));
          break;
        case 'Home':
          event.preventDefault();
          dispatch(setSelectedTimePoint(1));
          break;
        case 'End':
          event.preventDefault();
          dispatch(setSelectedTimePoint(dayCount));
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTimePoint, dayCount, dispatch]);

  if (activeTab === 'compare') {
    return (
      <div className="timeseries-container">
        <div className="mb-6">
          <CompareChart />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="timeseries-container">Loading time series data...</div>;
  }

  if (error) {
    return <div className="timeseries-container">Error: {error}</div>;
  }

  const getChartTitle = () => {
    if (activeTab === 'exposure') {
      if (viewRunIds.length === 0) {
        return 'Exposure Time Series - Select runs';
      }
      if (selectedFeatureIds.length === 0) {
        return "Exposure Time Series - All Features";
      }
      return "Exposure Time Series - Selected Features";
    }
    if (selectedFeatureIds.length === 0) {
      return "Time Series Charts - Overall Average (All Features)";
    }
    return "Time Series Charts - Average Values";
  };

  const getStatusMessage = () => {
    if (selectedFeatureIds.length === 0) {
      return "Showing overall average across all features";
    }
    return `Features: ${selectedFeatureIds.length} (click map background to deselect)`;
  };

  return (
    <div className="timeseries-container">
      <h3 className="text-lg font-semibold mb-4">{getChartTitle()}</h3>
      {selectedTimePoint && (
        <div style={{ marginBottom: '15px', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Selected Day: {selectedTimePoint} | {getStatusMessage()}</span>
          {selectedFeatureIds.length > 0 && (
            <button 
              onClick={() => dispatch(clearSelection())}
              style={{
                background: '#f0f0f0',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                marginLeft: '10px'
              }}
              title="Clear feature selection"
            >
              Clear Selection
            </button>
          )}
        </div>
      )}
      
      {viewRunIds.length > 0 && activeTab === 'nectar-pollen' && (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #93c5fd',
              borderRadius: 4,
              padding: '6px 10px',
              fontSize: 12,
              color: '#1d4ed8',
              marginBottom: 10,
            }}
          >
            Nectar and pollen are shared across runs for this scenario. The application timeline below follows the selected run set.
          </div>
        )}

      {/* Nectar & Pollen Charts using Trellis Layout */}
      {activeTab === 'nectar-pollen' && (
        <div className="mb-6">
          {(() => {
            const seriesData = [];
            
            if (layers.Nectar?.visible) {
              seriesData.push({
                data: averageData,
                dataKey: "nectar_avg",
                title: "Total Nectar Availability",
                color: "#2563eb",
                yAxisLabel: "Total Nectar Availability"
              });
            }
            
            if (layers.Pollen?.visible) {
              seriesData.push({
                data: averageData,
                dataKey: "pollen_avg",
                title: "Total Pollen Availability",
                color: "#dc2626",
                yAxisLabel: "Total Pollen Availability"
              });
            }
            
            return seriesData.length > 0 ? (
              <TrellisTimeSeriesChart
                seriesData={seriesData}
                applicationData={applicationTimelineData}
                height={400}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                No nectar/pollen layers visible. Enable layers in the controls.
              </div>
            );
          })()}
        </div>
      )}
      
      {/* Bee Population Charts using Trellis Layout */}
      {activeTab === 'bee-population' && (
        <div className="mb-6">
          {viewRunIds.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
                fontSize: 12,
                color: '#374151',
              }}
            >
              <label htmlFor="bee-line-scope" style={{ fontWeight: 600 }}>Display:</label>
              <select
                id="bee-line-scope"
                value={beeLineScope}
                onChange={(e) => setBeeLineScope(e.target.value)}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  padding: '4px 8px',
                  background: '#fff',
                  color: '#111827',
                }}
              >
                <option value="mc">Individual MC runs</option>
                <option value="hive_mean">Average MC runs per hive</option>
              </select>
            </div>
          )}
          {(() => {
            if (!viewRunIds || viewRunIds.length === 0) {
              return (
                <div className="text-center py-8 text-gray-500">
                  Select one or more runs in the header to view colony metrics.
                </div>
              );
            }
            const buildSeries = (layerKey, metric, title, color, yAxisLabel) => {
              if (!layers[layerKey]?.visible) return null;
              const lines = beeLineScope === 'hive_mean'
                ? getHiveMeanLines(metric)
                : getMultiRunLines(metric);
              if (!lines) return null;
              return { title, color, yAxisLabel, lines };
            };

            const seriesData = [
              buildSeries(
                'TotalColony',
                'TotalIHbees + TotalForagers + TotalDroneEggs + TotalEggs + TotalDroneLarvae + TotalLarvae + TotalDronePupae + TotalPupae',
                'Total Colony Size',
                '#1b9e77',
                'Total Population'
              ),
              buildSeries(
                'TotalAdults',
                'TotalIHbees + TotalForagers',
                'Adults (Workers)',
                '#d95f02',
                'Number of Adult Bees'
              ),
              buildSeries(
                'AllEggs',
                'TotalDroneEggs + TotalEggs',
                'All Eggs',
                '#7570b3',
                'Number of Eggs'
              ),
              buildSeries(
                'AllLarvae',
                'TotalDroneLarvae + TotalLarvae',
                'All Larvae',
                '#e7298a',
                'Number of Larvae'
              ),
              buildSeries(
                'AllPupae',
                'TotalDronePupae + TotalPupae',
                'All Pupae',
                '#66a61e',
                'Number of Pupae'
              ),
            ].filter(Boolean);

            if (seriesData.length === 0) {
              return (
                <div className="text-center py-8 text-gray-500">
                  Loading per-run replicate data… make sure colony layers are visible in the sidebar.
                </div>
              );
            }
            return (
              <>
                <div className="text-xs text-gray-600 mb-2">
                  {beeLineScope === 'hive_mean'
                    ? `Showing MC-averaged lines per hive from ${viewRunIds.length} selected run${viewRunIds.length === 1 ? '' : 's'}.`
                    : `Showing replicate-mean lines for ${viewRunIds.length} selected run${viewRunIds.length === 1 ? '' : 's'}.`}
                </div>
                <TrellisTimeSeriesChart
                  seriesData={seriesData}
                  applicationData={[]}
                  height={500}
                  startDate={availableRuns.find(r => r.id === viewRunIds[0])?.sim_start || null}
                />
              </>
            );
          })()}
        </div>
      )}
      
      {/* Exposure Charts using Trellis Layout */}
      {activeTab === 'exposure' && (
        <div className="mb-6">
          {viewRunIds.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
                fontSize: 12,
                color: '#374151',
              }}
            >
              <label htmlFor="exposure-line-scope" style={{ fontWeight: 600 }}>Display:</label>
              <select
                id="exposure-line-scope"
                value={exposureLineScope}
                onChange={(e) => setExposureLineScope(e.target.value)}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  padding: '4px 8px',
                  background: '#fff',
                  color: '#111827',
                }}
              >
                <option value="mc">Individual MC runs</option>
                <option value="hive_mean">Average MC runs per hive</option>
              </select>
            </div>
          )}
          {(() => {
            if (viewRunIds.length === 0) {
              return (
                <div className="text-center py-8 text-gray-500">
                  Select one or more runs in the header to view exposure time series.
                </div>
              );
            }

            const lineBuilder = exposureLineScope === 'hive_mean'
              ? getExposureHiveMeanLines
              : getExposureLines;
            const nectarLines = lineBuilder('nectar_exposure');
            const pollenLines = lineBuilder('pollen_exposure');
            const contactLines = lineBuilder('contact_exposure');
            const seriesData = [
              {
                lines: nectarLines,
                title: "Nectar Exposure",
                color: "#2563eb",
                yAxisLabel: "Nectar Exposure"
              },
              {
                lines: pollenLines,
                title: "Pollen Exposure", 
                color: "#dc2626",
                yAxisLabel: "Pollen Exposure"
              },
              {
                lines: contactLines,
                title: "Contact Exposure",
                color: "#059669",
                yAxisLabel: "Contact Exposure"
              }
            ].filter(series => series.lines && series.lines.length > 0);
            
            if (isExposureLoading && seriesData.length === 0) {
              return (
                <div className="text-center py-8 text-gray-500">
                  Loading run-specific exposure data...
                </div>
              );
            }

            if (exposureRequestError && seriesData.length === 0) {
              return (
                <div className="text-center py-8 text-red-600">
                  {exposureRequestError}
                </div>
              );
            }

            return seriesData.length > 0 ? (
              <TrellisTimeSeriesChart
                seriesData={seriesData}
                applicationData={applicationTimelineData}
                height={500}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                No exposure data available. Check if applications data is loaded.
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
};

export default TimeSeriesChart;
