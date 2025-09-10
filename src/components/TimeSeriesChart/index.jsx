import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedTimePoint, setAvailableTimePoints } from '../../store/timeSlice';
import { loadBeePopulationTimeSeries } from '../../utils/viewportLoader';
import SingleTimeSeriesChart from '../SingleTimeSeriesChart';

const TimeSeriesChart = ({ activeTab = 'nectar-pollen' }) => {
  const dispatch = useDispatch();
  const [averageData, setAverageData] = useState([]);
  const [beePopulationData, setBeePopulationData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { selectedTimePoint } = useSelector(state => state.time);
  const selectedFeatureIds = useSelector(state => state.selection.selectedFeatureIds);
  const layers = useSelector(state => state.layers);

  const fetchAverageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let url = 'http://localhost:8000/api/timeseries/averages?include_nectar=true&include_pollen=true';
      
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

  // Transform bee population data to chart format
  const getBeeChartData = (metricKey) => {
    if (!beePopulationData || !beePopulationData[metricKey] || !beePopulationData.days) {
      return [];
    }
    
    return beePopulationData.days.map((day, index) => ({
      day: day,
      [metricKey]: beePopulationData[metricKey][index]
    }));
  };

  useEffect(() => {
    fetchAverageData();
    fetchBeePopulationData();
  }, [fetchAverageData, fetchBeePopulationData]);

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
    if (selectedFeatureIds.length === 0) {
      return "Time Series Charts - Overall Average (All Features)";
    }
    return "Time Series Charts - Average Values";
  };

  const getStatusMessage = () => {
    if (selectedFeatureIds.length === 0) {
      return "Showing overall average across all features";
    }
    return `Features: ${selectedFeatureIds.length}`;
  };

  return (
    <div className="timeseries-container">
      <h3 className="text-lg font-semibold mb-4">{getChartTitle()}</h3>
      {selectedTimePoint && (
        <div style={{ marginBottom: '15px', fontSize: '14px', color: '#666' }}>
          Selected Day: {selectedTimePoint} | {getStatusMessage()}
        </div>
      )}
      
      {/* Nectar Chart */}
      {activeTab === 'nectar-pollen' && layers.Nectar?.visible && (
        <div className="mb-6">
          <SingleTimeSeriesChart
            data={averageData}
            dataKey="nectar_avg"
            title="Nectar Concentration"
            color="#2563eb"
            yAxisLabel="Nectar Concentration"
            height={300}
          />
        </div>
      )}
      
      {/* Pollen Chart */}
      {activeTab === 'nectar-pollen' && layers.Pollen?.visible && (
        <div className="mb-6">
          <SingleTimeSeriesChart
            data={averageData}
            dataKey="pollen_avg"
            title="Pollen Concentration"
            color="#dc2626"
            yAxisLabel="Pollen Concentration"
            height={300}
          />
        </div>
      )}
      
      {/* Bee Population Charts */}
      {activeTab === 'bee-population' && layers.TotalEggs?.visible && (
        <div className="mb-6">
          <SingleTimeSeriesChart
            data={getBeeChartData('totalEggs')}
            dataKey="totalEggs"
            title="Total Eggs"
            color="#FFA500"
            yAxisLabel="Number of Eggs"
            height={300}
          />
        </div>
      )}
      
      {activeTab === 'bee-population' && layers.TotalLarvae?.visible && (
        <div className="mb-6">
          <SingleTimeSeriesChart
            data={getBeeChartData('totalLarvae')}
            dataKey="totalLarvae"
            title="Total Larvae"
            color="#FF6347"
            yAxisLabel="Number of Larvae"
            height={300}
          />
        </div>
      )}
      
      {activeTab === 'bee-population' && layers.TotalPupae?.visible && (
        <div className="mb-6">
          <SingleTimeSeriesChart
            data={getBeeChartData('totalPupae')}
            dataKey="totalPupae"
            title="Total Pupae"
            color="#FF4500"
            yAxisLabel="Number of Pupae"
            height={300}
          />
        </div>
      )}
      
      {activeTab === 'bee-population' && layers.TotalIHbees?.visible && (
        <div className="mb-6">
          <SingleTimeSeriesChart
            data={getBeeChartData('totalIHbees')}
            dataKey="totalIHbees"
            title="In-Hive Bees"
            color="#0000FF"
            yAxisLabel="Number of In-Hive Bees"
            height={300}
          />
        </div>
      )}
      
      {activeTab === 'bee-population' && layers.TotalForagers?.visible && (
        <div className="mb-6">
          <SingleTimeSeriesChart
            data={getBeeChartData('totalForagers')}
            dataKey="totalForagers"
            title="Foragers"
            color="#00FF00"
            yAxisLabel="Number of Foragers"
            height={300}
          />
        </div>
      )}
      
      {activeTab === 'bee-population' && layers.TotalWorkers?.visible && (
        <div className="mb-6">
          <SingleTimeSeriesChart
            data={getBeeChartData('totalIHbees + totalForagers')}
            dataKey="totalIHbees + totalForagers"
            title="Total Workers"
            color="#800080"
            yAxisLabel="Number of Workers"
            height={300}
          />
        </div>
      )}
      
      {activeTab === 'bee-population' && layers.TotalDroneEggs?.visible && (
        <div className="mb-6">
          <SingleTimeSeriesChart
            data={getBeeChartData('totalDroneEggs')}
            dataKey="totalDroneEggs"
            title="Drone Eggs"
            color="#FFC0CB"
            yAxisLabel="Number of Drone Eggs"
            height={300}
          />
        </div>
      )}
      
      {activeTab === 'bee-population' && layers.TotalDroneLarvae?.visible && (
        <div className="mb-6">
          <SingleTimeSeriesChart
            data={getBeeChartData('totalDroneLarvae')}
            dataKey="totalDroneLarvae"
            title="Drone Larvae"
            color="#FF1493"
            yAxisLabel="Number of Drone Larvae"
            height={300}
          />
        </div>
      )}
      
      {activeTab === 'bee-population' && layers.TotalDronePupae?.visible && (
        <div className="mb-6">
          <SingleTimeSeriesChart
            data={getBeeChartData('totalDronePupae')}
            dataKey="totalDronePupae"
            title="Drone Pupae"
            color="#C71585"
            yAxisLabel="Number of Drone Pupae"
            height={300}
          />
        </div>
      )}
      
      {activeTab === 'bee-population' && layers.TotalDrones?.visible && (
        <div className="mb-6">
          <SingleTimeSeriesChart
            data={getBeeChartData('totalDrones')}
            dataKey="totalDrones"
            title="Drones"
            color="#8B008B"
            yAxisLabel="Number of Drones"
            height={300}
          />
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
