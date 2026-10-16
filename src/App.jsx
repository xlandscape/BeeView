import React, { useEffect, lazy, Suspense } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LandUseHistogram from './components/Histogram/LandUseHistogram';
import ChartDrawer from './components/ChartDrawer';
import DockedDrawer from './components/Drawer/DockedDrawer';
import LayoutVars from './components/LayoutVars';
// Loaded on demand: most sessions never open the simulation panel.
const SimulationPanel = lazy(() => import('./components/SimulationPanel'));
import { setSelectedTimePoint } from './store/timeSlice';
import './App.css';

/**
 * Map-first layout: the map fills the viewport, everything else is an overlay
 * (translucent top bar, docked drawers left/right/bottom, simulation panel).
 * Overlay sizes are published as --inset-* CSS variables by LayoutVars.
 */
function App() {
  const dispatch = useDispatch();
  const simulationPanelOpen = useSelector((state) => state.simulation.panelOpen);

  useEffect(() => {
    // Start at day 1; data is loaded lazily by the components.
    dispatch(setSelectedTimePoint(1));
  }, [dispatch]);

  return (
    <div className="app-shell">
      <LayoutVars />
      <div className="map-layer">
        <Map />
      </div>

      <Header />

      <DockedDrawer id="left" title="Layers">
        <Sidebar />
      </DockedDrawer>

      {/* The simulation panel takes the right edge while open. */}
      {!simulationPanelOpen && (
        <DockedDrawer id="right" title="Land use">
          <LandUseHistogram />
        </DockedDrawer>
      )}

      <ChartDrawer />

      {simulationPanelOpen && (
        <Suspense fallback={null}>
          <SimulationPanel />
        </Suspense>
      )}
    </div>
  );
}

export default App;
