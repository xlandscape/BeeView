import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as d3 from 'd3';
import { selectFeature } from '../../store/actions/selectionActions';
import { getLandUseColor } from '../../utils/colorScales';
import { analyzeLandUseData } from '../../utils/landUseAnalysis';

function LandUseHistogram() {
  const svgRef = useRef(null);
  const landUseData = useSelector(state => state.map.landUseData);
  // const selectedFeatureIds = useSelector(state => state.selection.selectedFeatureIds);
  const activeFilters = useSelector(state => state.map.activeL1Filters);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!landUseData || !landUseData.features || !svgRef.current) return;

    // Analyze land use data
    const landUseStats = analyzeLandUseData(landUseData);

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const height = svgRef.current.clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales
    const x = d3.scaleBand()
      .domain(landUseStats.map(d => d.type))
      .range([0, width])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(landUseStats, d => d.area)])
      .nice()
      .range([height, 0]);

    // Draw axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    svg.append("g")
      .call(d3.axisLeft(y));

    // Add axis labels
    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom - 5)
      .text("Land Use Type");

    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 15)
      .attr("x", -height / 2)
      .text("Area (hectares)");

    // Draw bars
    svg.selectAll(".bar")
      .data(landUseStats)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.type))
      .attr("y", d => y(d.area))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y(d.area))
      .attr("fill", d => {
        const color = getLandUseColor(d.type);
        return `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.8)`;
      })
      .attr("stroke", d => {
        // Highlight if any feature of this type is selected
        const isSelected = activeFilters.includes(d.type);
        return isSelected ? "#000" : "none";
      })
      .attr("stroke-width", d => {
        const isSelected = activeFilters.includes(d.type);
        return isSelected ? 2 : 0;
      })
      .on("click", (event, d) => {
        // Select all features of this land use type
        d.featureIds.forEach(id => dispatch(selectFeature(id)));
      });

  }, [landUseData, activeFilters, dispatch]);

  return (
    <div className="histogram-container">
      <h3>Land Use Distribution</h3>
      <svg ref={svgRef} width="100%" height="250"></svg>
    </div>
  );
}

export default LandUseHistogram;