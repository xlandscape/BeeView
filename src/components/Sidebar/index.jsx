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
        </div>
      )}
    </div>
  );
}


export default Sidebar;