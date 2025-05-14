// src/components/Sidebar/index.js
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import './Sidebar.css';
import { toggleLayer } from '../../store/slices/mapSlice';

const Sidebar = () => {
  const dispatch = useDispatch();
  const visibleLayers = useSelector(state => state.map.visibleLayers);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLayerToggle = (layerName) => {
    dispatch(toggleLayer(layerName));
  };

  return (
    <div className={`sidebar \${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h2>BeeView</h2>
        <button 
          className="collapse-button" 
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? '›' : '‹'}
        </button>
      </div>
      
      {!isCollapsed && (
        <>
          <div className="sidebar-section">
            <h3>Layers</h3>
            <div className="layer-controls">
              <div className="layer-control">
                <input 
                  type="checkbox" 
                  id="landUseLayer" 
                  checked={visibleLayers.landUse || false} 
                  onChange={() => handleLayerToggle('landUse')}
                />
                <label htmlFor="landUseLayer">Land Use</label>
              </div>
              <div className="layer-control">
                <input 
                  type="checkbox" 
                  id="resourceLayer" 
                  checked={visibleLayers.resources || false} 
                  onChange={() => handleLayerToggle('resources')}
                />
                <label htmlFor="resourceLayer">Nectar & Pollen Resources</label>
              </div>
              <div className="layer-control">
                <input 
                  type="checkbox" 
                  id="hivesLayer" 
                  checked={visibleLayers.hives || false} 
                  onChange={() => handleLayerToggle('hives')}
                />
                <label htmlFor="hivesLayer">Bee Hives</label>
              </div>
              <div className="layer-control">
                <input 
                  type="checkbox" 
                  id="flightPathsLayer" 
                  checked={visibleLayers.flightPaths || false} 
                  onChange={() => handleLayerToggle('flightPaths')}
                />
                <label htmlFor="flightPathsLayer">Flight Paths</label>
              </div>
              <div className="layer-control">
                <input 
                  type="checkbox" 
                  id="exposureLayer" 
                  checked={visibleLayers.exposure || false} 
                  onChange={() => handleLayerToggle('exposure')}
                />
                <label htmlFor="exposureLayer">Pesticide Exposure</label>
              </div>
            </div>
          </div>
          
          <div className="sidebar-section">
            <h3>Analysis</h3>
            <div className="analysis-controls">
              <button className="analysis-button">Calculate Foraging Area</button>
              <button className="analysis-button">Resource Availability</button>
              <button className="analysis-button">Export Data</button>
            </div>
          </div>
          
          <div className="sidebar-section">
            <h3>Information</h3>
            <div className="info-panel">
              <p><strong>Selected Feature:</strong> <span id="selected-feature">None</span></p>
              <p><strong>Land Use Area:</strong> <span id="land-use-area">0 ha</span></p>
              <p><strong>Resource Quality:</strong> <span id="resource-quality">N/A</span></p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Sidebar;