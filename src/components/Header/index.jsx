// src/components/Header/index.js
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ViewRunsPicker from '../ViewRunsPicker';
import { toggleSimulationPanel } from '../../store/slices/simulationSlice';
import './Header.css';

function Header() {
  const dispatch = useDispatch();
  const panelOpen = useSelector((state) => state.simulation.panelOpen);

  return (
    <div className="header">
      <div className="header-title">
        <h1>BeeView</h1>
        <span className="header-subtitle">xPollinator Visualization</span>
      </div>
      <div className="header-runs">
        <ViewRunsPicker />
      </div>
      <div className="header-actions">
        <button
          className={`header-button sim-launch-btn ${panelOpen ? 'active' : ''}`}
          onClick={() => dispatch(toggleSimulationPanel())}
          title="Launch new xPollinator simulation"
        >
          🚀 New Simulation
        </button>
      </div>
    </div>
  );
}

export default Header;