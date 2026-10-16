import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ViewRunsPicker from '../ViewRunsPicker';
import { toggleSimulationPanel } from '../../store/slices/simulationSlice';
import { setHeaderHeight, toggleHeader, resetLayout } from '../../store/slices/uiSlice';
import useContainerSize from '../../hooks/useContainerSize';
import './Header.css';

/**
 * Thin translucent bar over the map. Its measured height becomes --inset-top so
 * drawers and map widgets start below it; collapsed it shrinks to a pill.
 */
function Header() {
  const dispatch = useDispatch();
  const panelOpen = useSelector((state) => state.simulation.panelOpen);
  const open = useSelector((state) => state.ui.header.open);
  const [barRef, { height }] = useContainerSize();

  useEffect(() => {
    if (open && height > 0) dispatch(setHeaderHeight(height));
  }, [open, height, dispatch]);

  if (!open) {
    return (
      <button
        type="button"
        className="topbar-handle"
        onClick={() => dispatch(toggleHeader())}
        title="Show header"
      >
        BeeView ▾
      </button>
    );
  }

  return (
    <div className="topbar" ref={barRef}>
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
        <button
          type="button"
          className="header-icon-button"
          onClick={() => dispatch(resetLayout())}
          title="Reset panel layout"
        >
          ⟲
        </button>
        <button
          type="button"
          className="header-icon-button"
          onClick={() => dispatch(toggleHeader())}
          title="Hide header"
        >
          ▴
        </button>
      </div>
    </div>
  );
}

export default Header;
