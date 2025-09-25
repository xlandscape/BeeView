import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import { selectFeature } from '../../store/actions/selectionActions';
import { getLevel1LandUseColor, getLevel2LandUseColor, getLevel3LandUseColor } from '../../utils/colorScales';

function LandUseSunburst() {
  const svgRef = useRef(null);
  const landUseData = useSelector(state => state.map.landUseData);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!landUseData || !landUseData.features || !svgRef.current) return;

    // Prepare hierarchical data
    const root = {
      name: "Land Use",
      children: []
    };

    // Group by L1 -> L2 -> L3
    const hierarchy = {};
    landUseData.features.forEach(feature => {
      const props = feature.properties;
      const l1 = props.L1_label || 'Unknown';
      const l2 = props.L2_label || 'Unknown';
      const l3 = props.L3_label || 'Unknown';
      const area = parseFloat(props.area) || 0;

      if (!hierarchy[l1]) hierarchy[l1] = {};
      if (!hierarchy[l1][l2]) hierarchy[l1][l2] = {};
      if (!hierarchy[l1][l2][l3]) {
        hierarchy[l1][l2][l3] = { 
          area: 0, 
          featureIds: [],
          level: 3
        };
      }
      
      hierarchy[l1][l2][l3].area += area;
      hierarchy[l1][l2][l3].featureIds.push(feature.id);
    });

    // Convert to D3 hierarchy format
    Object.entries(hierarchy).forEach(([l1Key, l1Value]) => {
      const l1Node = { name: l1Key, children: [], level: 1 };
      
      Object.entries(l1Value).forEach(([l2Key, l2Value]) => {
        const l2Node = { name: l2Key, children: [], level: 2 };
        
        Object.entries(l2Value).forEach(([l3Key, l3Data]) => {
          l2Node.children.push({
            name: l3Key,
            value: l3Data.area,
            featureIds: l3Data.featureIds,
            level: 3
          });
        });
        
        l1Node.children.push(l2Node);
      });
      
      root.children.push(l1Node);
    });

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up dimensions
    const width = Math.min(svgRef.current.clientWidth, 400);
    const height = Math.min(svgRef.current.clientHeight, 400);
    const radius = Math.min(width, height) / 2;

    const svg = d3.select(svgRef.current)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Create hierarchy and partition layout
    const hierarchyData = d3.hierarchy(root)
      .sum(d => d.value || 0)
      .sort((a, b) => b.value - a.value);

    const partition = d3.partition().size([2 * Math.PI, radius]);
    partition(hierarchyData);

    // Color scale based on hierarchy level
    const getColor = (d) => {
      if (d.depth === 1) {
        const color = getLevel1LandUseColor(d.data.name);
        return `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.8)`;
      } else if (d.depth === 2) {
        const color = getLevel2LandUseColor(d.data.name);
        return `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.7)`;
      } else if (d.depth === 3) {
        const color = getLevel3LandUseColor(d.data.name);
        return `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6)`;
      }
      return '#ccc';
    };

    // Create arc generator
    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => Math.sqrt(d.y0))
      .outerRadius(d => Math.sqrt(d.y1));

    // Draw arcs
    svg.selectAll("path")
      .data(hierarchyData.descendants().filter(d => d.depth > 0))
      .enter()
      .append("path")
      .attr("d", arc)
      .style("fill", getColor)
      .style("stroke", "#fff")
      .style("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this).style("opacity", 0.8);
        
        // Show tooltip
        const tooltip = d3.select("body").append("div")
          .attr("class", "sunburst-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0,0,0,0.8)")
          .style("color", "white")
          .style("padding", "5px")
          .style("border-radius", "3px")
          .style("pointer-events", "none")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px")
          .html(`
            <div><strong>${d.data.name}</strong></div>
            <div>Level: ${d.depth}</div>
            <div>Area: ${d.value?.toFixed(2) || 0}</div>
            ${d.data.featureIds ? `<div>Features: ${d.data.featureIds.length}</div>` : ''}
          `);
      })
      .on("mouseout", function(event, d) {
        d3.select(this).style("opacity", 1);
        d3.selectAll(".sunburst-tooltip").remove();
      })
      .on("click", (event, d) => {
        if (d.data.featureIds) {
          d.data.featureIds.forEach(id => dispatch(selectFeature(id)));
        }
      });

    // Add center label
    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .text("Land Use");

  }, [landUseData, dispatch]);

  return (
    <div className="sunburst-container">
      <h3>Land Use Hierarchy (Sunburst)</h3>
      <p style={{ fontSize: '12px', color: '#666' }}>
        Inner=Level 1, Middle=Level 2, Outer=Level 3. Click segments to select features.
      </p>
      <svg ref={svgRef} width="100%" height="400"></svg>
    </div>
  );
}

export default LandUseSunburst;