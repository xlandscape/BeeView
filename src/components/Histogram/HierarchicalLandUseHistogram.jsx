import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import { selectFeature } from '../../store/actions/selectionActions';
import { getLandUseColor, getLevel1LandUseColor, getLevel2LandUseColor, getLevel3LandUseColor } from '../../utils/colorScales';
import { analyzeLandUseData } from '../../utils/landUseAnalysis';

function HierarchicalLandUseHistogram() {
  const svgRef = useRef(null);
  const landUseData = useSelector(state => state.map.landUseData);
  const activeFilters = useSelector(state => state.map.activeL1Filters);
  const dispatch = useDispatch();
  
  const [viewLevel, setViewLevel] = useState(1); // 1, 2, or 3
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  const analyzeHierarchicalData = (features) => {
    const hierarchy = {};
    let totalArea = 0;

    features.forEach(feature => {
      const props = feature.properties;
      const l1 = props.L1_label || 'Unknown L1';
      const l2 = props.L2_label || 'Unknown L2';
      const l3 = props.L3_label || 'Unknown L3';
      const area = parseFloat(props.area) || 0;
      
      totalArea += area;

      if (!hierarchy[l1]) {
        hierarchy[l1] = { area: 0, children: {}, featureIds: [] };
      }
      hierarchy[l1].area += area;
      hierarchy[l1].featureIds.push(feature.id);

      if (!hierarchy[l1].children[l2]) {
        hierarchy[l1].children[l2] = { area: 0, children: {}, featureIds: [] };
      }
      hierarchy[l1].children[l2].area += area;
      hierarchy[l1].children[l2].featureIds.push(feature.id);

      if (!hierarchy[l1].children[l2].children[l3]) {
        hierarchy[l1].children[l2].children[l3] = { area: 0, featureIds: [] };
      }
      hierarchy[l1].children[l2].children[l3].area += area;
      hierarchy[l1].children[l2].children[l3].featureIds.push(feature.id);
    });

    return { hierarchy, totalArea };
  };

  const getCurrentLevelData = (hierarchy) => {
    if (viewLevel === 1) {
      return Object.entries(hierarchy).map(([key, value]) => ({
        type: key,
        area: value.area,
        featureIds: value.featureIds,
        hasChildren: Object.keys(value.children).length > 0,
        level: 1
      }));
    } else if (viewLevel === 2) {
      const data = [];
      Object.entries(hierarchy).forEach(([l1Key, l1Value]) => {
        if (expandedCategories.has(l1Key) || expandedCategories.size === 0) {
          Object.entries(l1Value.children).forEach(([l2Key, l2Value]) => {
            data.push({
              type: l2Key,
              parentType: l1Key,
              area: l2Value.area,
              featureIds: l2Value.featureIds,
              hasChildren: Object.keys(l2Value.children).length > 0,
              level: 2
            });
          });
        }
      });
      return data;
    } else { // viewLevel === 3
      const data = [];
      Object.entries(hierarchy).forEach(([l1Key, l1Value]) => {
        Object.entries(l1Value.children).forEach(([l2Key, l2Value]) => {
          if (expandedCategories.has(`${l1Key}/${l2Key}`) || expandedCategories.size === 0) {
            Object.entries(l2Value.children).forEach(([l3Key, l3Value]) => {
              data.push({
                type: l3Key,
                parentType: `${l1Key}/${l2Key}`,
                area: l3Value.area,
                featureIds: l3Value.featureIds,
                level: 3
              });
            });
          }
        });
      });
      return data;
    }
  };

  useEffect(() => {
    if (!landUseData || !landUseData.features || !svgRef.current) return;

    const { hierarchy } = analyzeHierarchicalData(landUseData.features);
    const currentData = getCurrentLevelData(hierarchy);

    // Sort by area (descending)
    currentData.sort((a, b) => b.area - a.area);

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up dimensions
    const margin = { top: 60, right: 30, bottom: 100, left: 70 };
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const height = svgRef.current.clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales
    const x = d3.scaleBand()
      .domain(currentData.map(d => d.type))
      .range([0, width])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(currentData, d => d.area)])
      .nice()
      .range([height, 0]);

    // Draw axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .style("font-size", viewLevel === 3 ? "8px" : "10px");

    svg.append("g")
      .call(d3.axisLeft(y));

    // Draw bars
    svg.selectAll(".bar")
      .data(currentData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.type))
      .attr("y", d => y(d.area))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y(d.area))
      .attr("fill", d => {
        let color;
        if (d.level === 1) color = getLevel1LandUseColor(d.type);
        else if (d.level === 2) color = getLevel2LandUseColor(d.type);
        else color = getLevel3LandUseColor(d.type);
        return `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.8)`;
      })
      .attr("stroke", d => {
        const isSelected = activeFilters.includes(d.type);
        return isSelected ? "#000" : "none";
      })
      .attr("stroke-width", 2)
      .style("cursor", d => d.hasChildren ? "pointer" : "default")
      .on("click", (event, d) => {
        if (d.hasChildren && viewLevel < 3) {
          // Expand this category
          const key = d.level === 1 ? d.type : `${d.parentType}/${d.type}`;
          const newExpanded = new Set(expandedCategories);
          if (newExpanded.has(key)) {
            newExpanded.delete(key);
          } else {
            newExpanded.add(key);
          }
          setExpandedCategories(newExpanded);
          if (viewLevel < 3) setViewLevel(viewLevel + 1);
        } else {
          // Select features
          d.featureIds.forEach(id => dispatch(selectFeature(id)));
        }
      });

    // Add area labels on bars
    svg.selectAll(".bar-label")
      .data(currentData.filter(d => d.area > 0))
      .enter()
      .append("text")
      .attr("class", "bar-label")
      .attr("x", d => x(d.type) + x.bandwidth() / 2)
      .attr("y", d => y(d.area) - 5)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#333")
      .text(d => `${(d.area / 1000).toFixed(1)}k`); // Convert to thousands

  }, [landUseData, viewLevel, expandedCategories, activeFilters, dispatch]);

  return (
    <div className="histogram-container">
      <div className="histogram-controls" style={{ marginBottom: '10px' }}>
        <h3>Land Use Distribution (Level {viewLevel})</h3>
        <div>
          <button 
            onClick={() => { setViewLevel(1); setExpandedCategories(new Set()); }}
            className={viewLevel === 1 ? 'active' : ''}
          >
            L1 (Broad)
          </button>
          <button 
            onClick={() => setViewLevel(2)}
            className={viewLevel === 2 ? 'active' : ''}
          >
            L2 (Specific)
          </button>
          <button 
            onClick={() => setViewLevel(3)}
            className={viewLevel === 3 ? 'active' : ''}
          >
            L3 (Detailed)
          </button>
          <button onClick={() => setExpandedCategories(new Set())}>
            Reset View
          </button>
        </div>
      </div>
      <svg ref={svgRef} width="100%" height="400"></svg>
    </div>
  );
}

export default HierarchicalLandUseHistogram;