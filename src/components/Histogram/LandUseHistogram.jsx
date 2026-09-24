import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { select, selectAll } from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';
import { axisLeft, axisBottom } from 'd3-axis';
import { max } from 'd3-array';
import { format } from 'd3-format';
import { selectMultipleFeatures } from '../../store/reducers/selectionReducer';
import { getLevel1LandUseColor, getLevel2LandUseColor, getLevel3LandUseColor, getVegetationColor } from '../../utils/colorScales';

// Helper function to abbreviate long labels
const abbreviateLabel = (label, maxLength = 30) => {
  if (label.length <= maxLength) return label;
  return label.substring(0, maxLength - 3) + '...';
};

// Individual Histogram Component
function SingleHistogram({ title, data, colorFunction, height = 200, onBarClick }) {
  const svgRef = useRef(null);
  const selectedFeatureIds = useSelector(state => state.selection.selectedFeatureIds);
  const selectedSet = useMemo(() => new Set(selectedFeatureIds), [selectedFeatureIds]);

  // Build the chart only when the data changes.
  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    // Clear previous chart
    select(svgRef.current).selectAll("*").remove();

    // Set up dimensions for horizontal layout
    const margin = { top: 20, right: 60, bottom: 30, left: 150 }; // Increased left margin for labels
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = select(svgRef.current)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales - SWAPPED for horizontal layout
    const y = scaleBand()
      .domain(data.map(d => d.type))
      .range([0, chartHeight])
      .padding(0.1);

    const maxArea = max(data, d => d.area);
    const x = scaleLinear()
      .domain([0, maxArea])
      .range([0, width]);

    // Draw axes with only two ticks: 0 and maximum
    svg.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(axisBottom(x).tickValues([0, maxArea]).tickFormat(format(".1f")));

    svg.append("g")
      .call(axisLeft(y))
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
      .on("mouseover", function(event, d) {
        select(this).style("filter", "brightness(1.1)");

        // Tooltip
        select("body").append("div")
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
        select(this).style("filter", "none");
        selectAll(".histogram-tooltip").remove();
      })
      .on("click", (event, d) => {
        if (onBarClick) {
          onBarClick(d);
        }
      });

  }, [data, colorFunction, height, onBarClick]);

  // Selection only changes bar opacity, so update that in place.
  useEffect(() => {
    if (!svgRef.current) return;
    const hasSelection = selectedSet.size > 0;
    select(svgRef.current).selectAll(".bar")
      .attr("opacity", d => {
        if (!hasSelection) return 1; // No selection, show all at full opacity
        // Check if this category has any selected features
        const hasSelectedFeatures = d.featureIds.some(id => selectedSet.has(id));
        return hasSelectedFeatures ? 1 : 0.3; // Selected: full opacity, others: dimmed
      });
  }, [selectedSet, data]);

  return (
    <div style={{ marginBottom: '20px' }}>
      <h4 style={{ margin: '10px 0', color: '#333', fontSize: '16px' }}>{title}</h4>
      <svg ref={svgRef} width="100%" height={height}></svg>
    </div>
  );
}

// Aggregate feature areas per category for one level (top 20 by area).
function prepareHistogramData(features, level, vegetationCodesMap) {
  if (!features) return [];

  const aggregatedData = {};

  features.forEach(feature => {
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
      const vegetationInfo = featureId && vegetationCodesMap ? vegetationCodesMap[featureId] : null;
      if (!vegetationInfo) {
        key = 'No Vegetation Data';
      } else {
        key = vegetationInfo.vegetation_name || 'Unknown Vegetation';
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
}

function LandUseHistogram() {
  const features = useSelector(state => state.map.landUseData?.features ?? null);
  const vegetationCodesMap = useSelector(state => state.map.vegetationCodesMap);
  const selectedFeatureIds = useSelector(state => state.selection.selectedFeatureIds);
  const dispatch = useDispatch();

  // Keep the latest selection in a ref so the click handler stays stable
  // (a changing handler would force every histogram to rebuild its SVG).
  const selectedRef = useRef(selectedFeatureIds);
  selectedRef.current = selectedFeatureIds;

  // Clicking a bar toggles its whole category in one dispatch: if every
  // feature of the category is already selected, deselect them; otherwise
  // add the missing ones.
  const handleBarClick = useCallback((d) => {
    const next = new Set(selectedRef.current);
    const allSelected = d.featureIds.every(id => next.has(id));
    if (allSelected) {
      d.featureIds.forEach(id => next.delete(id));
    } else {
      d.featureIds.forEach(id => next.add(id));
    }
    dispatch(selectMultipleFeatures(Array.from(next)));
  }, [dispatch]);

  const l1Data = useMemo(() => prepareHistogramData(features, 'L1'), [features]);
  const l2Data = useMemo(() => prepareHistogramData(features, 'L2'), [features]);
  const l3Data = useMemo(() => prepareHistogramData(features, 'L3'), [features]);
  const vegetationData = useMemo(
    () => prepareHistogramData(features, 'vegetation', vegetationCodesMap),
    [features, vegetationCodesMap]
  );

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
        colorFunction={getVegetationColor}
        height={240}
        onBarClick={handleBarClick}
      />
    </div>
  );
}

export default LandUseHistogram;
