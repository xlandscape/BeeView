import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { loadBeePopulationTimeSeries } from '../../utils/viewportLoader';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const BeePopulationChart = () => {
  const [beeTimeSeriesData, setBeeTimeSeriesData] = useState(null);
  const [selectedMetrics, setSelectedMetrics] = useState(['totalEggs', 'totalLarvae', 'totalForagers']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { selectedTimePoint } = useSelector(state => state.time);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await loadBeePopulationTimeSeries();
        setBeeTimeSeriesData(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load bee population time series:', err);
        setError('Failed to load bee population data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleMetricToggle = (metric) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  if (loading) {
    return <div className="p-4">Loading bee population chart...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  if (!beeTimeSeriesData) {
    return <div className="p-4">No bee population data available</div>;
  }

  // Prepare chart data
  const days = beeTimeSeriesData.days || [];
  
  // Color palette for different metrics
  const colors = {
    'totalEggs': 'rgb(255, 255, 0)',
    'totalLarvae': 'rgb(255, 165, 0)', 
    'totalPupae': 'rgb(255, 140, 0)',
    'totalIHbees': 'rgb(0, 0, 255)',
    'totalForagers': 'rgb(0, 255, 0)',
    'totalIHbees + totalForagers': 'rgb(128, 0, 128)',
    'totalDroneEggs': 'rgb(255, 192, 203)',
    'totalDroneLarvae': 'rgb(255, 20, 147)',
    'totalDronePupae': 'rgb(199, 21, 133)',
    'totalDrones': 'rgb(139, 0, 139)'
  };

  const datasets = selectedMetrics.map(metric => {
    const values = beeTimeSeriesData[metric] || [];
    return {
      label: metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      data: values,
      borderColor: colors[metric] || 'rgb(75, 192, 192)',
      backgroundColor: (colors[metric] || 'rgb(75, 192, 192)') + '20',
      tension: 0.1,
    };
  });

  const chartData = {
    labels: days,
    datasets: datasets,
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Bee Population Over Time',
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Day'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Population Count'
        }
      }
    },
    interaction: {
      intersect: false,
    },
    plugins: {
      tooltip: {
        filter: function(tooltipItem) {
          return tooltipItem.dataIndex === Math.floor(selectedTimePoint);
        }
      }
    }
  };

  // Available metrics for selection
  const availableMetrics = Object.keys(beeTimeSeriesData).filter(key => key !== 'days');

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Bee Population Metrics</h3>
        <div className="flex flex-wrap gap-2">
          {availableMetrics.map(metric => (
            <button
              key={metric}
              onClick={() => handleMetricToggle(metric)}
              className={`px-3 py-1 text-sm rounded ${
                selectedMetrics.includes(metric)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            </button>
          ))}
        </div>
      </div>
      
      <div className="h-96">
        <Line data={chartData} options={options} />
      </div>
      
      {selectedTimePoint && (
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <h4 className="font-semibold">Day {selectedTimePoint} Values:</h4>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {selectedMetrics.map(metric => {
              const value = beeTimeSeriesData[metric]?.[selectedTimePoint] || 'N/A';
              return (
                <div key={metric} className="text-sm">
                  <span className="font-medium">{metric}:</span> {value}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BeePopulationChart;
