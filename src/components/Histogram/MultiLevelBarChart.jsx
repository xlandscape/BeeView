import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import { selectFeature } from '../../store/actions/selectionActions';
import { getLevel1LandUseColor, getLevel2LandUseColor, getLevel3LandUseColor } from '../../utils/colorScales';

function MultiLevelBarChart() {
  const svgRef = useRef(null);
  const landUseData = useSelector(state => state.map.landUseData);
  const dispatch = useDispatch();
  
  const [currentLevel, setCurrentLevel] = useState(1);
  const [selectedL1, setSelectedL1] = useState(null);
  const [selectedL2, setSelectedL2] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!landUseData || !landUseData.features || !svgRef.current) return;

    // Prepare data based on current level and selections
    const aggregatedData = {};
    
    landUseData.features.forEach(feature => {
      const props = feature.properties;
      const l1 = props.L1_label || 'Unknown';
      const l2 = props.L2_label || 'Unknown';
      const l3 = props.L3_label || 'Unknown';
      const area = parseFloat(props.area) || 0;

      let key;
      if (currentLevel === 1) {
        key = l1;
      } else if (currentLevel === 2) {
        if (!selectedL1 || l1 === selectedL1) {
          key = l2;
        } else {
          return;
        }
      } else if (currentLevel === 3) {
        if (selectedL1 && l1 !== selectedL1) return;
        if (selectedL2 && l2 !== selectedL2) return;
        key = l3;
      }

      // Apply search filter
      if (searchTerm && !key.toLowerCase().includes(searchTerm.toLowerCase())) {
        return;
      }

      if (!aggregatedData[key]) {
        aggregatedData[key] = {
          area: 0,
          featureIds: [],
          l1: l1,
          l2: l2,
          l3: l3
        };
      }

      aggregatedData[key].area += area;
      aggregatedData[key].featureIds.push(feature.id);
    });

    // Convert to array and sort
    const data = Object.entries(aggregatedData)
      .map(([key, value]) => ({ name: key, ...value }))
      .sort((a, b) => b.area - a.area)
      .slice(0, 20); // Limit to top 20 for readability

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    if (data.length === 0) return;

    // Set up dimensions
    const margin = { top: 20, right: 30, bottom: 100, left: 60 };
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleBand()
      .domain(data.map(d => d.name))
      .range([0, width])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.area)])
      .range([height, 0]);

    // Color function
    const getColor = (d) => {
      let color;
      if (currentLevel === 1) {
        color = getLevel1LandUseColor(d.name);
      } else if (currentLevel === 2) {
        color = getLevel2LandUseColor(d.name);
      } else {
        color = getLevel3LandUseColor(d.name);
      }
      return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    };

    // Draw bars
    svg.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => xScale(d.name))
      .attr("width", xScale.bandwidth())
      .attr("y", d => yScale(d.area))
      .attr("height", d => height - yScale(d.area))
      .attr("fill", getColor)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this).attr("opacity", 0.7);
        
        // Tooltip
        const tooltip = d3.select("body").append("div")
          .attr("class", "bar-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0,0,0,0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("pointer-events", "none")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px")
          .html(`
            <div><strong>${d.name}</strong></div>
            <div>Area: ${d.area.toFixed(2)}</div>
            <div>Features: ${d.featureIds.length}</div>
          `);
      })
      .on("mouseout", function() {
        d3.select(this).attr("opacity", 1);
        d3.selectAll(".bar-tooltip").remove();
      })
      .on("click", (event, d) => {
        if (currentLevel === 1) {
          setSelectedL1(d.name);
          setCurrentLevel(2);
        } else if (currentLevel === 2) {
          setSelectedL2(d.name);
          setCurrentLevel(3);
        } else {
          d.featureIds.forEach(id => dispatch(selectFeature(id)));
        }
      });

    // X axis
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")
      .style("font-size", "10px");

    // Y axis
    svg.append("g")
      .call(d3.axisLeft(yScale));

    // Y axis label
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Area");

  }, [landUseData, currentLevel, selectedL1, selectedL2, searchTerm, dispatch]);

  const getBreadcrumb = () => {
    const parts = ["All Land Use"];
    if (selectedL1) parts.push(selectedL1);
    if (selectedL2) parts.push(selectedL2);
    return parts.join(" > ");
  };

  const resetLevel = (level) => {
    if (level === 1) {
      setSelectedL1(null);
      setSelectedL2(null);
      setCurrentLevel(1);
    } else if (level === 2) {
      setSelectedL2(null);
      setCurrentLevel(2);
    }
  };

  return (
    <div className="multi-level-chart-container">
      <h3>Land Use Distribution (Level {currentLevel})</h3>
      
      {/* Navigation */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '14px', marginBottom: '5px' }}>
          <strong>Navigation:</strong> {getBreadcrumb()}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => resetLevel(1)} disabled={currentLevel === 1}>
            Level 1
          </button>
          <button onClick={() => resetLevel(2)} disabled={currentLevel <= 2 || !selectedL1}>
            Level 2
          </button>
          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '3px', border: '1px solid #ccc' }}
          />
        </div>
      </div>

      {/* Instructions */}
      <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
        {currentLevel < 3 
          ? "Click bars to drill down to next level" 
          : "Click bars to select map features"
        }
        {searchTerm && ` (Filtered by: "${searchTerm}")`}
      </p>

      <svg ref={svgRef} width="100%" height="400"></svg>
    </div>
  );
}

export default MultiLevelBarChart;