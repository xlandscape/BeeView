import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import * as turf from '@turf/turf';
import { selectFeature } from '../../store/actions/selectionActions';
import { getLevel1LandUseColor, getLevel2LandUseColor, getLevel3LandUseColor, getVegetationColor } from '../../utils/colorScales';
import { analyzeLandUseData } from '../../utils/landUseAnalysis';

// Individual Histogram Component
function SingleHistogram({ title, data, colorFunction, height = 200, onBarClick }) {
  const svgRef = useRef(null);
  const selectedFeatureIds = useSelector(state => state.selection.selectedFeatureIds);

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up dimensions
    const margin = { top: 20, right: 30, bottom: 60, left: 60 };
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales
    const x = d3.scaleBand()
      .domain(data.map(d => d.type))
      .range([0, width])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.area)])
      .nice()
      .range([chartHeight, 0]);

    // Draw axes
    svg.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .style("font-size", "10px");

    svg.append("g")
      .call(d3.axisLeft(y));

    // Add axis labels
    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("x", width / 2)
      .attr("y", chartHeight + margin.bottom - 10)
      .style("font-size", "12px")
      .text("Category");

    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 15)
      .attr("x", -chartHeight / 2)
      .style("font-size", "12px")
      .text("Feature Count");

    // Check if any features are selected
    const hasSelection = selectedFeatureIds.length > 0;

    // Draw bars
    svg.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.type))
      .attr("y", d => y(d.area))
      .attr("width", x.bandwidth())
      .attr("height", d => chartHeight - y(d.area))
      .attr("fill", d => {
        const color = colorFunction(d.type);
        return `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.8)`;
      })
      .attr("stroke", "#333")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .attr("opacity", d => {
        if (!hasSelection) return 1; // No selection, show all at full opacity
        
        // Check if this category has any selected features
        const hasSelectedFeatures = d.featureIds.some(id => selectedFeatureIds.includes(id));
        return hasSelectedFeatures ? 1 : 0.3; // Selected: full opacity, others: dimmed
      })
      .on("mouseover", function(event, d) {
        d3.select(this).style("filter", "brightness(1.1)");
        
        // Tooltip
        const tooltip = d3.select("body").append("div")
          .attr("class", "histogram-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0,0,0,0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("pointer-events", "none")
          .style("font-size", "12px")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px")
          .html(`
            <div><strong>${d.type}</strong></div>
            <div>Count: ${d.area.toFixed(0)}</div>
            <div>Features: ${d.featureIds.length}</div>
          `);
      })
      .on("mouseout", function() {
        d3.select(this).style("filter", "none");
        d3.selectAll(".histogram-tooltip").remove();
      })
      .on("click", (event, d) => {
        if (onBarClick) {
          onBarClick(d);
        }
      });

  }, [data, colorFunction, height, onBarClick, selectedFeatureIds]);

  return (
    <div style={{ marginBottom: '20px' }}>
      <h4 style={{ margin: '10px 0', color: '#333', fontSize: '16px' }}>{title}</h4>
      <svg ref={svgRef} width="100%" height={height}></svg>
    </div>
  );
}

function LandUseHistogram() {
  const landUseData = useSelector(state => state.map.landUseData);
  const vegetationCodesMap = useSelector(state => state.map.vegetationCodesMap);
  const activeFilters = useSelector(state => state.map.activeL1Filters);

  // Add verification console log
  useEffect(() => {
    console.log('LandUseHistogram: vegetationCodesMap keys count:', vegetationCodesMap ? Object.keys(vegetationCodesMap).length : 0);
  }, [vegetationCodesMap]);
  const dispatch = useDispatch();

  // Prepare data for different levels
  const prepareHistogramData = (level) => {
    if (!landUseData || !landUseData.features) return [];

    const aggregatedData = {};
    
    landUseData.features.forEach(feature => {
      const props = feature.properties;
      let key;
      
      if (level === 'L1') {
        key = props.L1_label || 'Unknown';
      } else if (level === 'L2') {
        key = props.L2_label || 'Unknown';
      } else if (level === 'L3') {
        key = props.L3_label || 'Unknown';
      } else if (level === 'vegetation') {
        // Use vegetation mapping - match map component logic with new format
        const featureId = feature.id;

        if (!featureId || !vegetationCodesMap || !vegetationCodesMap[featureId]) {
          key = 'No Vegetation Data';
        } else {
          const vegetationInfo = vegetationCodesMap[featureId];
          const vegetationType = vegetationInfo.vegetation_name;
          key = vegetationType || 'Unknown Vegetation';
        }
      }

      // For now, just count features (each feature = 1 unit)
      // TODO: Calculate actual area when geometry is properly available
      const area = 1;

      if (!aggregatedData[key]) {
        aggregatedData[key] = {
          type: key,
          area: 0,
          featureIds: []
        };
      }

      aggregatedData[key].area += area;
      aggregatedData[key].featureIds.push(feature.id);
    });

    return Object.values(aggregatedData)
      .sort((a, b) => b.area - a.area)
      .slice(0, 20); // Limit to top 20 for readability
  };

  const handleBarClick = (d) => {
    d.featureIds.forEach(id => dispatch(selectFeature(id)));
  };

  const l1Data = prepareHistogramData('L1');
  const l2Data = prepareHistogramData('L2');
  const l3Data = prepareHistogramData('L3');
  const vegetationData = prepareHistogramData('vegetation');

  return (
    <div style={{ 
      background: 'white', 
      borderRadius: '8px', 
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      margin: '10px'
    }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Land Use Distribution</h3>
      <p style={{ fontSize: '12px', color: '#666', marginBottom: '20px' }}>
        Click bars to select features on the map. Selected features will be highlighted with full opacity while others are dimmed. Showing top 20 categories by feature count.
      </p>

      <SingleHistogram 
        title="Level 1 - Major Land Use Categories"
        data={l1Data}
        colorFunction={getLevel1LandUseColor}
        height={220}
        onBarClick={handleBarClick}
      />

      <SingleHistogram 
        title="Level 2 - Detailed Land Use Categories"
        data={l2Data}
        colorFunction={getLevel2LandUseColor}
        height={240}
        onBarClick={handleBarClick}
      />

      <SingleHistogram 
        title="Level 3 - Specific Land Use Categories"
        data={l3Data}
        colorFunction={getLevel3LandUseColor}
        height={260}
        onBarClick={handleBarClick}
      />

      <SingleHistogram 
        title="Vegetation Types"
        data={vegetationData}
        colorFunction={(type) => {
          // Use the same color function as the vegetation layer in the map
          return getVegetationColor(type);
        }}
        height={240}
        onBarClick={handleBarClick}
      />
    </div>
  );
}

export default LandUseHistogram;