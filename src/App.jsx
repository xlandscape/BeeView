import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LandUseHistogram from './components/Histogram/LandUseHistogram';
import TimeSeriesChart from './components/TimeSeriesChart';
import SimulationPanel from './components/SimulationPanel';
import { setSelectedTimePoint } from './store/timeSlice';
import './App.css';

function App() {
  const dispatch = useDispatch();
  const [activeChartTab, setActiveChartTab] = useState('nectar-pollen');
  const simulationPanelOpen = useSelector((state) => state.simulation.panelOpen);

  useEffect(() => {
    // Initialize app with just the default time point
    const initializeApp = async () => {
      try {
        // Set first time point (day 1) as default
        // No need to fetch and select all features initially for better performance
        dispatch(setSelectedTimePoint(1));
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };

    initializeApp();
  }, [dispatch]);

  return (
    <div className="app-container">
      <Header />
      <div className="main-content">
        <Sidebar />
        <div className="content-area">
          <div className="map-chart-stack">
            <div className="map-container">
              <Map />
            </div>
            <div className="bottom-chart">
              {/* Chart Tabs */}
              <div className="chart-tabs">
                <button
                  className={`tab-button ${activeChartTab === 'nectar-pollen' ? 'active' : ''}`}
                  onClick={() => setActiveChartTab('nectar-pollen')}
                >
                  Nectar & Pollen
                </button>
                <button
                  className={`tab-button ${activeChartTab === 'bee-population' ? 'active' : ''}`}
                  onClick={() => setActiveChartTab('bee-population')}
                >
                  Bee Population
                </button>
                <button
                  className={`tab-button ${activeChartTab === 'exposure' ? 'active' : ''}`}
                  onClick={() => setActiveChartTab('exposure')}
                >
                  Exposure
                </button>
                <button
                  className={`tab-button ${activeChartTab === 'compare' ? 'active' : ''}`}
                  onClick={() => setActiveChartTab('compare')}
                >
                  Compare runs
                </button>
              </div>
              
              {/* Chart Content - Always show TimeSeriesChart but filter based on active tab */}
              <div className="chart-content">
                <TimeSeriesChart activeTab={activeChartTab} />
              </div>
            </div>
          </div>
          <div className="side-chart">
            <LandUseHistogram />
          </div>
        </div>
        {simulationPanelOpen && <SimulationPanel />}
      </div>
    </div>
  );
}

export default App;