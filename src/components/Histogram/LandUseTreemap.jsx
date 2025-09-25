import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import { selectFeature } from '../../store/actions/selectionActions';
import { getLevel3LandUseColor } from '../../utils/colorScales';

function LandUseTreemap() {
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
          fullPath: `${l1}/${l2}/${l3}`
        };
      }
      
      hierarchy[l1][l2][l3].area += area;
      hierarchy[l1][l2][l3].featureIds.push(feature.id);
    });

    // Convert to D3 hierarchy format
    Object.entries(hierarchy).forEach(([l1Key, l1Value]) => {
      const l1Node = { name: l1Key, children: [] };
      
      Object.entries(l1Value).forEach(([l2Key, l2Value]) => {
        const l2Node = { name: l2Key, children: [] };
        
        Object.entries(l2Value).forEach(([l3Key, l3Data]) => {
          l2Node.children.push({
            name: l3Key,
            value: l3Data.area,
            featureIds: l3Data.featureIds,
            fullPath: l3Data.fullPath
          });
        });
        
        l1Node.children.push(l2Node);
      });
      
      root.children.push(l1Node);
    });

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up dimensions
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current);

    // Create hierarchy and treemap layout
    const hierarchyData = d3.hierarchy(root)
      .sum(d => d.value || 0)
      .sort((a, b) => b.value - a.value);

    const treemap = d3.treemap()
      .size([width, height])
      .padding(1);

    treemap(hierarchyData);

    // Draw rectangles
    const leaf = svg.selectAll("g")
      .data(hierarchyData.leaves())
      .enter().append("g")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

    leaf.append("rect")
      .attr("fill", d => {
        const color = getLevel3LandUseColor(d.data.name);
        return `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.8)`;
      })
      .attr("stroke", "#fff")
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        d.data.featureIds.forEach(id => dispatch(selectFeature(id)));
      });

    // Add text labels (only for larger rectangles)
    leaf.append("text")
      .attr("x", 3)
      .attr("y", 13)
      .style("font-size", d => Math.min(12, (d.x1 - d.x0) / 8) + "px")
      .style("fill", "#333")
      .style("pointer-events", "none")
      .text(d => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        return width > 60 && height > 20 ? d.data.name : "";
      })
      .each(function(d) {
        const width = d.x1 - d.x0;
        const textLength = this.getComputedTextLength();
        if (textLength > width - 6) {
          d3.select(this).text("");
        }
      });

  }, [landUseData, dispatch]);

  return (
    <div className="treemap-container">
      <h3>Land Use Distribution (Treemap)</h3>
      <p style={{ fontSize: '12px', color: '#666' }}>
        Area proportional to size. Click rectangles to select features.
      </p>
      <svg ref={svgRef} width="100%" height="300"></svg>
    </div>
  );
}

export default LandUseTreemap;