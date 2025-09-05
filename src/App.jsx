import React from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LandUseHistogram from './components/Histogram/LandUseHistogram';
import TimeSeriesChart from './components/TimeSeriesChart';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <Header />
      <div className="main-content">
        <Sidebar />
        <div className="content-area">
          <div className="map-container">
            <Map />
          </div>
          <div className="chart-stack">
            <LandUseHistogram />
            <TimeSeriesChart />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;