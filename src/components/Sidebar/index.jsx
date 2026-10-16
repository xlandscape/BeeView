import React, { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import './Sidebar.css';
import { toggleL1Filter } from '../../store/slices/mapSlice';
import LayerControls from '../LayerControls';

/** Layer checkboxes and the L1 land-use filter; lives in the left drawer. */
function Sidebar() {
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

  return (
    <div className="layer-panel">
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
      <LayerControls layer="Pollen" label="Pollen" />
      <LayerControls layer="Nectar" label="Nectar" />
      <LayerControls layer="Beehive" label="Beehive Location" />
      <LayerControls layer="Vegetation" label="Vegetation" />
      <LayerControls layer="Applications" label="Applications" />

      <h3 className="sidebar-section-header">Bee Population</h3>
      <LayerControls layer="TotalColony" label="Total Colony" />
      <LayerControls layer="TotalAdults" label="Adults (Workers)" />
      <LayerControls layer="AllEggs" label="All Eggs" />
      <LayerControls layer="AllLarvae" label="All Larvae" />
      <LayerControls layer="AllPupae" label="All Pupae" />
    </div>
  );
}

export default Sidebar;
