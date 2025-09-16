import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import './Sidebar.css';
import { toggleL1Filter } from '../../store/slices/mapSlice';
import LayerControls from '../LayerControls';

function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
            {/* Add controls here */}
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
          
          <h3 className="sidebar-section-header">Bee Population</h3>
          <LayerControls layer="TotalEggs" label="Total Eggs">
            {/* Add controls here */}
          </LayerControls>
          <LayerControls layer="TotalLarvae" label="Total Larvae">
            {/* Add controls here */}
          </LayerControls>
          <LayerControls layer="TotalPupae" label="Total Pupae">
            {/* Add controls here */}
          </LayerControls>
          <LayerControls layer="TotalIHbees" label="In-Hive Bees">
            {/* Add controls here */}
          </LayerControls>
          <LayerControls layer="TotalForagers" label="Foragers">
            {/* Add controls here */}
          </LayerControls>
          <LayerControls layer="TotalWorkers" label="Total Workers">
            {/* Add controls here */}
          </LayerControls>
          <LayerControls layer="TotalDroneEggs" label="Drone Eggs">
            {/* Add controls here */}
          </LayerControls>
          <LayerControls layer="TotalDroneLarvae" label="Drone Larvae">
            {/* Add controls here */}
          </LayerControls>
          <LayerControls layer="TotalDronePupae" label="Drone Pupae">
            {/* Add controls here */}
          </LayerControls>
          <LayerControls layer="TotalDrones" label="Total Drones">
            {/* Add controls here */}
          </LayerControls>
        </div>
      )}
    </div>
  );
}


export default Sidebar;