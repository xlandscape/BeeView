import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import * as d3 from 'd3';

function TimeSeriesChart() {
  const selectedIds = useSelector(state => state.selection.selectedFeatureIds);
  const [seriesData, setSeriesData] = useState([]);
  const svgRef = useRef(null);

  useEffect(() => {
    if (!selectedIds.length) {
      setSeriesData([]);
      return;
    }
    // Fetch time series for all selected features
    Promise.all(
      selectedIds.map(id =>
        fetch(`http://localhost:8080/nectar/timeseries/${id}`)
          .then(res => res.json())
          .then(data => ({ id, series: data.nectar_timeseries }))
      )
    ).then(setSeriesData);
  }, [selectedIds]);

  useEffect(() => {
    if (!seriesData.length || !svgRef.current) return;

    // D3 rendering
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const height = svgRef.current.clientHeight - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll("*").remove();
    const svg = d3.select(svgRef.current)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X and Y scales
    const x = d3.scaleLinear().domain([0, 364]).range([0, width]);
    const y = d3.scaleLinear()
      .domain([0, d3.max(seriesData, d => d3.max(d.series))])
      .nice()
      .range([height, 0]);

    // Axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(12));
    svg.append("g").call(d3.axisLeft(y));

    // Line generator
    const line = d3.line()
      .x((d, i) => x(i))
      .y(d => y(d));

    // Color scale
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Draw lines
    seriesData.forEach((d, i) => {
      svg.append("path")
        .datum(d.series)
        .attr("fill", "none")
        .attr("stroke", color(i))
        .attr("stroke-width", 2)
        .attr("d", line);
    });

  }, [seriesData]);

  return (
    <div className="timeseries-container" style={{ height: 250 }}>
      <h3>Nectar Time Series</h3>
      <svg ref={svgRef} width="100%" height="200"></svg>
      {!seriesData.length && <div>Select features on the nectar layer to view time series.</div>}
    </div>
  );
}

export default TimeSeriesChart;