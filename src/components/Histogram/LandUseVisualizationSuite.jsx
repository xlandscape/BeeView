import React, { useState } from 'react';
import HierarchicalLandUseHistogram from './HierarchicalLandUseHistogram';
import LandUseTreemap from './LandUseTreemap';
import LandUseSunburst from './LandUseSunburst';
import MultiLevelBarChart from './MultiLevelBarChart';

function LandUseVisualizationSuite() {
  const [activeView, setActiveView] = useState('hierarchical');

  const visualizations = [
    { key: 'hierarchical', name: 'Hierarchical Histogram', component: HierarchicalLandUseHistogram },
    { key: 'treemap', name: 'Treemap', component: LandUseTreemap },
    { key: 'sunburst', name: 'Sunburst', component: LandUseSunburst },
    { key: 'multilevel', name: 'Multi-Level Bar Chart', component: MultiLevelBarChart }
  ];

  const ActiveComponent = visualizations.find(v => v.key === activeView)?.component || HierarchicalLandUseHistogram;

  return (
    <div style={{ 
      background: 'white', 
      borderRadius: '8px', 
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      margin: '10px'
    }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>
          Land Use Analysis ({visualizations.find(v => v.key === activeView)?.name})
        </h2>
        
        {/* Visualization Toggle */}
        <div style={{ 
          display: 'flex', 
          gap: '5px', 
          marginBottom: '10px',
          borderBottom: '2px solid #f0f0f0',
          paddingBottom: '10px'
        }}>
          {visualizations.map(viz => (
            <button
              key={viz.key}
              onClick={() => setActiveView(viz.key)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: activeView === viz.key ? '#007acc' : '#f5f5f5',
                color: activeView === viz.key ? 'white' : '#333',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
            >
              {viz.name}
            </button>
          ))}
        </div>

        {/* Description of current visualization */}
        <div style={{ 
          fontSize: '13px', 
          color: '#666', 
          backgroundColor: '#f9f9f9',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          {activeView === 'hierarchical' && (
            <>
              <strong>Hierarchical Histogram:</strong> Expandable tree view showing distribution across all three levels. 
              Click categories to expand/collapse, bars to select map features.
            </>
          )}
          {activeView === 'treemap' && (
            <>
              <strong>Treemap:</strong> Area-proportional rectangles showing land use distribution. 
              Larger areas = more land coverage. Click rectangles to select features.
            </>
          )}
          {activeView === 'sunburst' && (
            <>
              <strong>Sunburst:</strong> Radial hierarchy with inner (L1), middle (L2), and outer (L3) rings. 
              Hover for details, click segments to select features.
            </>
          )}
          {activeView === 'multilevel' && (
            <>
              <strong>Multi-Level Bar Chart:</strong> Interactive drill-down from L1→L2→L3 with search filtering. 
              Click bars to navigate deeper or select features at L3.
            </>
          )}
        </div>
      </div>

      {/* Active Visualization */}
      <ActiveComponent />
    </div>
  );
}

export default LandUseVisualizationSuite;