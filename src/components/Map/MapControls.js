// src/components/Map/MapControls.js
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleLayer } from '../../store/reducers/mapReducer';
import './MapControls.css';

const MapControls = () => {
  const dispatch = useDispatch();
  const visibleLayers = useSelector(state => state.map.visibleLayers);
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('layers');

  const handleLayerToggle = (layerName) => {
    dispatch(toggleLayer(layerName));
  };

  const handleZoomIn = () => {
    // This would be implemented with a custom hook or by dispatching an action
    // that modifies the viewState in your Map component
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }));
  };

  const handleZoomOut = () => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
  };

  const handleReset = () => {
    // Reset the map view to the initial state
    // This would be implemented by dispatching an action to reset viewState
  };

  return (
    <div className={`map-controls \${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="map-controls-header">
        <h3>Map Controls</h3>
        <button 
          className="toggle-button" 
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '−' : '+'}
        </button>
      </div>
      
      {expanded && (
        <>
          <div className="map-controls-tabs">
            <button 
              className={`tab-button \${activeTab === 'layers' ? 'active' : ''}`} 
              onClick={() => setActiveTab('layers')}
            >
              Layers
            </button>
            <button 
              className={`tab-button \${activeTab === 'tools' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tools')}
            >
              Tools
            </button>
          </div>
          
          <div className="map-controls-content">
            {activeTab === 'layers' && (
              <div className="layers-panel">
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
                    id="resourcesLayer" 
                    checked={visibleLayers.resources || false} 
                    onChange={() => handleLayerToggle('resources')}
                  />
                  <label htmlFor="resourcesLayer">Nectar & Pollen Resources</label>
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
            )}
            
            {activeTab === 'tools' && (
              <div className="tools-panel">
                <div className="zoom-controls">
                  <button className="tool-button" onClick={handleZoomIn}>Zoom In</button>
                  <button className="tool-button" onClick={handleZoomOut}>Zoom Out</button>
                  <button className="tool-button" onClick={handleReset}>Reset View</button>
                </div>
                <div className="measurement-tools">
                  <button className="tool-button">Measure Distance</button>
                  <button className="tool-button">Measure Area</button>
                </div>
                <div className="export-tools">
                  <button className="tool-button">Export Map</button>
                  <button className="tool-button">Export Data</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MapControls;