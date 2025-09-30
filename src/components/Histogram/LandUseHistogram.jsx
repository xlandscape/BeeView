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

    // Set up dimensions for horizontal layout
    const margin = { top: 20, right: 60, bottom: 30, left: 150 }; // Increased left margin for labels
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Helper function to abbreviate long labels
    const abbreviateLabel = (label, maxLength = 30) => {
      if (label.length <= maxLength) return label;
      return label.substring(0, maxLength - 3) + '...';
    };

    // Set up scales - SWAPPED for horizontal layout
    const y = d3.scaleBand()
      .domain(data.map(d => d.type))
      .range([0, chartHeight])
      .padding(0.1);

    const maxArea = d3.max(data, d => d.area);
    const x = d3.scaleLinear()
      .domain([0, maxArea])
      .range([0, width]);

    // Draw axes with only two ticks: 0 and maximum
    svg.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x).tickValues([0, maxArea]).tickFormat(d3.format(".1f")));

    svg.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("font-size", "11px")
      .style("text-anchor", "end")
      .text(d => abbreviateLabel(d));

    // X-axis label
    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("x", width / 2)
      .attr("y", chartHeight + margin.bottom - 5)
      .style("font-size", "12px")
      .text("Area (Hectares)");

    // Check if any features are selected
    const hasSelection = selectedFeatureIds.length > 0;

    // Draw horizontal bars
    svg.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", 0)
      .attr("y", d => y(d.type))
      .attr("width", d => x(d.area))
      .attr("height", y.bandwidth())
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
            <div><strong>Area:</strong> ${d.area < 0.1 ? d.area.toFixed(3) : d.area.toFixed(1)} ha</div>
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

      // Use actual area from feature properties (in hectares)
      const area = parseFloat(props.area_hectares) || 0;

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
        Click bars to select features on the map. Selected features will be highlighted with full opacity while others are dimmed. Showing top 20 categories by total area (hectares).
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