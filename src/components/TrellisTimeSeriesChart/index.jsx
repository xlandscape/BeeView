import React, { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as d3 from 'd3';
import { setSelectedTimePoint } from '../../store/timeSlice';

const SingleTimeSeriesChart = ({ 
  data, 
  dataKey, 
  title, 
  color, 
  yAxisLabel,
  height = 300 
}) => {
  const dispatch = useDispatch();
  const svgRef = useRef();
  const { selectedTimePoint } = useSelector(state => state.time);

  const drawChart = useCallback(() => {
    if (!data || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 60, bottom: 80, left: 60 };
    const width = 800 - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([1, 365])
      .range([0, width]);

    const values = data.map(d => d[dataKey] || 0);
    const yScale = d3.scaleLinear()
      .domain(d3.extent(values))
      .nice()
      .range([chartHeight, 0]);

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format('d')));

    g.append('g')
      .call(d3.axisLeft(yScale));

    // Add axis labels
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (chartHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(yAxisLabel);

    g.append('text')
      .attr('transform', `translate(${width / 2}, ${chartHeight + margin.bottom - 10})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Day of Year');

    // Create line generator
    const line = d3.line()
      .x(d => xScale(d.day))
      .y(d => yScale(d[dataKey] || 0))
      .curve(d3.curveMonotoneX);

    // Draw line
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add interactive areas for time selection
    const chartOverlay = g.append('rect')
      .attr('class', 'chart-overlay')
      .attr('width', width)
      .attr('height', chartHeight)
      .style('fill', 'rgba(0,0,0,0.02)')
      .style('pointer-events', 'all')
      .style('cursor', 'crosshair');

    const axisOverlay = g.append('rect')
      .attr('class', 'axis-overlay')
      .attr('y', chartHeight)
      .attr('width', width)
      .attr('height', 30)
      .style('fill', 'transparent')
      .style('pointer-events', 'all')
      .style('cursor', 'pointer');

    // Add vertical line for selected time point
    const verticalLine = g.append('line')
      .attr('class', 'time-selector')
      .attr('y1', -10)
      .attr('y2', chartHeight + 25)
      .style('stroke', color)
      .style('stroke-width', 2)
      .style('stroke-dasharray', '5,5')
      .style('opacity', 0);

    // Add time point indicator circle
    const timeIndicator = g.append('circle')
      .attr('class', 'time-indicator')
      .attr('r', 6)
      .style('fill', color)
      .style('stroke', 'white')
      .style('stroke-width', 2)
      .style('opacity', 0);

    // Function to handle time point selection
    function selectTimePoint(event) {
      const [mouseX] = d3.pointer(event);
      const day = Math.round(xScale.invert(mouseX));
      
      if (day >= 1 && day <= 365) {
        dispatch(setSelectedTimePoint(day));
        
        const x = xScale(day);
        verticalLine
          .attr('x1', x)
          .attr('x2', x)
          .style('opacity', 0.8);
          
        const dayData = data.find(d => d.day === day);
        if (dayData) {
          const indicatorY = yScale(dayData[dataKey] || 0);
          
          timeIndicator
            .attr('cx', x)
            .attr('cy', indicatorY)
            .style('opacity', 1);
        }
      }
    }

    // Function to show preview line
    function showPreview(event) {
      const [mouseX] = d3.pointer(event);
      const day = Math.round(xScale.invert(mouseX));
      
      if (day >= 1 && day <= 365) {
        const x = xScale(day);
        verticalLine
          .attr('x1', x)
          .attr('x2', x)
          .style('opacity', selectedTimePoint === day ? 0.8 : 0.4);
      }
    }

    // Add interactions to both overlays
    [chartOverlay, axisOverlay].forEach(overlay => {
      overlay.on('mousemove', showPreview);
      overlay.on('click', selectTimePoint);
      overlay.on('mouseleave', function() {
        if (!selectedTimePoint) {
          verticalLine.style('opacity', 0);
          timeIndicator.style('opacity', 0);
        }
      });
    });

    // Show selected time point if exists
    if (selectedTimePoint) {
      const x = xScale(selectedTimePoint);
      verticalLine
        .attr('x1', x)
        .attr('x2', x)
        .style('opacity', 0.8);
        
      const dayData = data.find(d => d.day === selectedTimePoint);
      if (dayData) {
        const indicatorY = yScale(dayData[dataKey] || 0);
        
        timeIndicator
          .attr('cx', x)
          .attr('cy', indicatorY)
          .style('opacity', 1);
      }
    }

  }, [data, dataKey, color, selectedTimePoint, dispatch, height, yAxisLabel]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  return (
    <div className="single-timeseries-container">
      <h4 className="text-md font-medium mb-2 text-gray-700">{title}</h4>
      <svg
        ref={svgRef}
        width="100%"
        style={{ minHeight: `${height}px` }}
      />
    </div>
  );
};

export default SingleTimeSeriesChart;
