import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedTimePoint, setAvailableTimePoints } from '../../store/timeSlice';
import { clearSelection } from '../../store/reducers/selectionReducer';
import { loadBeePopulationTimeSeries } from '../../utils/viewportLoader';
import { loadApplicationsData } from '../../utils/applicationsLoader';
import { buildApiUrl } from '../../config/api';
import { RUN_COLOR_PALETTE } from '../../store/slices/runsSlice';
import TrellisTimeSeriesChart from '../TrellisTimeSeriesChart';
import CompareChart from '../CompareChart';

const TimeSeriesChart = ({ activeTab = 'nectar-pollen' }) => {
  const dispatch = useDispatch();
  const [averageData, setAverageData] = useState([]);
  const [beePopulationData, setBeePopulationData] = useState(null);
  const [applicationsData, setApplicationsData] = useState([]);
  const [exposureData, setExposureData] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  // Per-run replicate aggregates: { [runId]: { metrics: { [name]: {days, mean, ...} } } }
  const [runReplicateData, setRunReplicateData] = useState({});

  const { selectedTimePoint } = useSelector(state => state.time);
  const selectedFeatureIds = useSelector(state => state.selection.selectedFeatureIds);
  const layers = useSelector(state => state.layers);
  const viewRunIds = useSelector(state => state.runs.viewRunIds);
  const availableRuns = useSelector(state => state.runs.availableRuns);

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
      
      // Set available time points (1-365)
      const timePoints = Array.from({ length: 365 }, (_, i) => i + 1);
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

  const fetchApplicationsData = useCallback(async () => {
    try {
      console.log('🚀 TimeSeriesChart: Loading applications data for features:', selectedFeatureIds);
      const data = await loadApplicationsData(selectedFeatureIds);
      console.log('✅ TimeSeriesChart: Received applications data:', data);
      setApplicationsData(data);
    } catch (err) {
      console.error('❌ TimeSeriesChart: Error fetching applications data:', err);
      setApplicationsData([]);
    }
  }, [selectedFeatureIds]);

  const fetchExposureData = useCallback(async () => {
    try {
      console.log('🚀 TimeSeriesChart: Loading exposure data for features:', selectedFeatureIds);
      
      let url = buildApiUrl('/api/exposure/timeseries');
      
      // If features are selected, add them to the query
      if (selectedFeatureIds.length > 0) {
        const featureIdsStr = selectedFeatureIds.join(',');
        url += `?feature_ids=${featureIdsStr}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ TimeSeriesChart: Received exposure data:', data);
      setExposureData(data.exposure_timeseries || []);
    } catch (err) {
      console.error('❌ TimeSeriesChart: Error fetching exposure data:', err);
      setExposureData([]);
    }
  }, [selectedFeatureIds]);

  // Transform bee population data to chart format
  const getBeeChartData = (metricKey) => {
    if (!beePopulationData || !beePopulationData.timeseries || !Array.isArray(beePopulationData.timeseries)) {
      return [];
    }
    
    // The API returns: {"timeseries": [{"day": 1, "totalEggs": 123, ...}, ...]}
    // Transform to chart format: [{day: 1, totalEggs: 123}, ...]
    return beePopulationData.timeseries.map(dayData => {
      let value = dayData[metricKey] || 0;
      
      return {
        day: dayData.day,
        [metricKey]: value
      };
    });
  };

  useEffect(() => {
    fetchAverageData();
    fetchBeePopulationData();
    fetchApplicationsData();
    fetchExposureData();
  }, [fetchAverageData, fetchBeePopulationData, fetchApplicationsData, fetchExposureData]);

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
          dispatch(setSelectedTimePoint(Math.min(365, selectedTimePoint + 1)));
          break;
        case 'Home':
          event.preventDefault();
          dispatch(setSelectedTimePoint(1));
          break;
        case 'End':
          event.preventDefault();
          dispatch(setSelectedTimePoint(365));
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTimePoint, dispatch]);

  if (isLoading) {
    return <div className="timeseries-container">Loading time series data...</div>;
  }

  if (error) {
    return <div className="timeseries-container">Error: {error}</div>;
  }

  const getChartTitle = () => {
    if (activeTab === 'exposure') {
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
      
      {/* Per-run banner for tabs that don't yet support per-run scoping */}
      {viewRunIds.length > 0 &&
        (activeTab === 'nectar-pollen' || activeTab === 'exposure') && (
          <div
            style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: 4,
              padding: '6px 10px',
              fontSize: 12,
              color: '#92400e',
              marginBottom: 10,
            }}
          >
            Per-run forage and exposure data is not yet supported. Showing default scenario data.
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
                title: "Nectar Concentration",
                color: "#2563eb",
                yAxisLabel: "Nectar Concentration"
              });
            }
            
            if (layers.Pollen?.visible) {
              seriesData.push({
                data: averageData,
                dataKey: "pollen_avg",
                title: "Pollen Concentration", 
                color: "#dc2626",
                yAxisLabel: "Pollen Concentration"
              });
            }
            
            return seriesData.length > 0 ? (
              <TrellisTimeSeriesChart
                seriesData={seriesData}
                applicationData={applicationsData}
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
              const lines = getMultiRunLines(metric);
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
                  Showing replicate-mean lines for {viewRunIds.length} selected run
                  {viewRunIds.length === 1 ? '' : 's'}.
                </div>
                <TrellisTimeSeriesChart
                  seriesData={seriesData}
                  applicationData={[]}
                  height={500}
                />
              </>
            );
          })()}
        </div>
      )}
      
      {/* Compare runs (treated vs untreated relative change + threshold exceedance) */}
      {activeTab === 'compare' && (
        <div className="mb-6">
          <CompareChart />
        </div>
      )}

      {/* Exposure Charts using Trellis Layout */}
      {activeTab === 'exposure' && (
        <div className="mb-6">
          {(() => {
            const seriesData = [
              {
                data: exposureData,
                dataKey: "nectar_exposure",
                title: "Nectar Exposure",
                color: "#2563eb",
                yAxisLabel: "Nectar Exposure"
              },
              {
                data: exposureData,
                dataKey: "pollen_exposure",
                title: "Pollen Exposure", 
                color: "#dc2626",
                yAxisLabel: "Pollen Exposure"
              },
              {
                data: exposureData,
                dataKey: "contact_exposure",
                title: "Contact Exposure",
                color: "#059669",
                yAxisLabel: "Contact Exposure"
              }
            ];
            
            return exposureData.length > 0 ? (
              <TrellisTimeSeriesChart
                seriesData={seriesData}
                applicationData={applicationsData}
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

      {/* Time Point Slider */}
      <div className="time-slider-container mt-4 px-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Day of Year: {selectedTimePoint || 1}
        </label>
        <div className="flex items-center space-x-3">
          <span className="text-xs text-gray-500">1</span>
          <input
            type="range"
            min="1"
            max="365"
            value={selectedTimePoint || 1}
            onChange={(e) => dispatch(setSelectedTimePoint(parseInt(e.target.value)))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #2563eb 0%, #2563eb ${((selectedTimePoint || 1) - 1) / 364 * 100}%, #e5e7eb ${((selectedTimePoint || 1) - 1) / 364 * 100}%, #e5e7eb 100%)`
            }}
          />
          <span className="text-xs text-gray-500">365</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Jan</span>
          <span>Feb</span>
          <span>Mar</span>
          <span>Apr</span>
          <span>May</span>
          <span>Jun</span>
          <span>Jul</span>
          <span>Aug</span>
          <span>Sep</span>
          <span>Oct</span>
          <span>Nov</span>
          <span>Dec</span>
        </div>
      </div>
      
      {/* Quick navigation buttons */}
      <div className="time-controls mt-2 px-4 flex gap-2 flex-wrap">
        <button
          onClick={() => dispatch(setSelectedTimePoint(Math.max(1, (selectedTimePoint || 1) - 1)))}
          className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
          disabled={selectedTimePoint <= 1}
        >
          ← Previous
        </button>
        <button
          onClick={() => dispatch(setSelectedTimePoint(Math.min(365, (selectedTimePoint || 1) + 1)))}
          className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
          disabled={selectedTimePoint >= 365}
        >
          Next →
        </button>
        <button
          onClick={() => dispatch(setSelectedTimePoint(91))}
          className="px-2 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
          title="April 1st - Spring Start"
        >
          Spring
        </button>
        <button
          onClick={() => dispatch(setSelectedTimePoint(182))}
          className="px-2 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded"
          title="July 1st - Summer Peak"
        >
          Summer
        </button>
        <button
          onClick={() => dispatch(setSelectedTimePoint(274))}
          className="px-2 py-1 text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 rounded"
          title="October 1st - Fall Start"
        >
          Fall
        </button>
      </div>
    </div>
  );
};

export default TimeSeriesChart;
