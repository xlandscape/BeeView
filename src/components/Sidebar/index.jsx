import React, { useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import './Sidebar.css';
import { toggleL1Filter } from '../../store/slices/mapSlice';
import LayerControls from '../LayerControls';

function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const dispatch = useDispatch();
  const activeL1Filters = useSelector((state) => state.map.activeL1Filters);
  const landUseData = useSelector((state) => state.map.landUseData);

  // Distinct L1 land-use classes present in the loaded landscape. Checked
  // classes are the only ones drawn (GPU filter in the Map); none checked
  // means no filtering.
  const l1Labels = useMemo(() => {
    const labels = new Set();
    (landUseData?.features || []).forEach((feature) => {
      const label = feature.properties?.L1_label;
      if (label) labels.add(label);
    });
    return Array.from(labels).sort();
  }, [landUseData]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };
  
  return (
    <div className={`sidebar${isCollapsed ? ' collapsed' : ''}`}>
      <button className="toggle-button" onClick={toggleSidebar}>
        {isCollapsed ? '>' : '<'}
      </button>
      {!isCollapsed && (
        <div className="sidebar-content">
          <h3 className="sidebar-section-header">Layers</h3>
          <LayerControls layer="LULC" label="Land Use / Land Cover">
            {l1Labels.length > 0 && (
              <div className="filter-controls">
                <div className="filter-hint">Show only (none checked = all)</div>
                {l1Labels.map((label) => (
                  <label key={label} className="filter-control">
                    <input
                      type="checkbox"
                      checked={activeL1Filters.includes(label)}
                      onChange={() => dispatch(toggleL1Filter(label))}
                    />
                    {' '}{label}
                  </label>
                ))}
              </div>
            )}
          </LayerControls>
          <LayerControls layer="Pollen" label="Pollen">
            {/* Add controls here */}
          </LayerControls>
          <LayerControls layer="Nectar" label="Nectar">
            {/* Add controls here */}
          </LayerControls>
          <LayerControls layer="Beehive" label="Beehive Location">
            {/* Add controls here */}
          </LayerControls>
          <LayerControls layer="Vegetation" label="Vegetation">
            {/* Add controls here */}
          </LayerControls>
          <LayerControls layer="Applications" label="Applications">
            {/* Features with plant protection product applications */}
          </LayerControls>
          
          <h3 className="sidebar-section-header">Bee Population</h3>
          <LayerControls layer="TotalColony" label="Total Colony">
            {/* Total Colony Size: All bees + all brood */}
          </LayerControls>
          <LayerControls layer="TotalAdults" label="Adults (Workers)">
            {/* In-hive bees + Foragers */}
          </LayerControls>
          <LayerControls layer="AllEggs" label="All Eggs">
            {/* Worker + Drone eggs combined */}
          </LayerControls>
          <LayerControls layer="AllLarvae" label="All Larvae">
            {/* Worker + Drone larvae combined */}
          </LayerControls>
          <LayerControls layer="AllPupae" label="All Pupae">
            {/* Worker + Drone pupae combined */}
          </LayerControls>
        </div>
      )}
    </div>
  );
}


export default Sidebar;