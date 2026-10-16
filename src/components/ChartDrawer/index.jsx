import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import DockedDrawer from '../Drawer/DockedDrawer';
import DaySlider from '../DaySlider';
import TimeSeriesChart from '../TimeSeriesChart';
import { setChartTab } from '../../store/slices/uiSlice';
import './ChartDrawer.css';

const TABS = [
  { id: 'nectar-pollen', label: 'Nectar & Pollen' },
  { id: 'bee-population', label: 'Bee Population' },
  { id: 'exposure', label: 'Exposure' },
  { id: 'compare', label: 'Compare runs' },
];

/**
 * Bottom drawer: chart tabs and the day slider live in the header strip, which
 * stays visible when the drawer is collapsed; the charts stay mounted underneath.
 */
export default function ChartDrawer() {
  const dispatch = useDispatch();
  const chartTab = useSelector((state) => state.ui.chartTab);

  const toolbar = (
    <>
      <div className="chart-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={chartTab === tab.id}
            className={`tab-button ${chartTab === tab.id ? 'active' : ''}`}
            onClick={() => dispatch(setChartTab(tab.id))}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <DaySlider />
    </>
  );

  return (
    <DockedDrawer id="bottom" title="Charts" toolbar={toolbar} persistentHeader>
      <TimeSeriesChart activeTab={chartTab} />
    </DockedDrawer>
  );
}
