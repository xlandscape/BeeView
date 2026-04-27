import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as d3 from 'd3';
import { setSelectedTimePoint } from '../../store/timeSlice';

const TrellisTimeSeriesChart = ({ 
  seriesData, // Array of {data, dataKey, title, color, yAxisLabel}
  height = 400,
  applicationData = [] // Application events data
}) => {
  const dispatch = useDispatch();
  const svgRef = useRef();
  const { selectedTimePoint } = useSelector(state => state.time);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: '' });

  const drawChart = useCallback(() => {
    if (!seriesData || seriesData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 80, bottom: 100, left: 80 };
    const width = 900 - margin.left - margin.right;
    
    // Calculate heights for trellis panels
    const applicationTimelineHeight = 40;
    const panelHeight = (height - margin.top - margin.bottom - applicationTimelineHeight - 20) / seriesData.length;
    const totalHeight = height + (seriesData.length - 1) * panelHeight;

    const mainG = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', totalHeight)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Shared x-scale
    const xScale = d3.scaleLinear()
      .domain([1, 365])
      .range([0, width]);

    // Create panels for each series
    seriesData.forEach((series, index) => {
      const { title, color, yAxisLabel } = series;
      // Multi-line mode: series.lines = [{data, dataKey, color, label}, ...].
      // Single-line mode (legacy): series.data + series.dataKey.
      const lines = (series.lines && series.lines.length > 0)
        ? series.lines
        : (series.data && series.dataKey
            ? [{ data: series.data, dataKey: series.dataKey, color, label: title }]
            : []);
      if (lines.length === 0 || lines.every(l => !l.data || l.data.length === 0)) return;
      const isMultiLine = (series.lines && series.lines.length > 0);

      const panelY = index * (panelHeight + 20);
      const g = mainG.append('g')
        .attr('transform', `translate(0, ${panelY})`);

      // Y-scale across all lines in this panel.
      const allValues = lines.flatMap(l => (l.data || []).map(d => d[l.dataKey] || 0));
      const yScale = d3.scaleLinear()
        .domain(d3.extent(allValues))
        .nice()
        .range([panelHeight, 0]);

      // Add background
      g.append('rect')
        .attr('width', width)
        .attr('height', panelHeight)
        .attr('fill', '#fafafa')
        .attr('stroke', '#e0e0e0')
        .attr('stroke-width', 1);

      // Add title
      g.append('text')
        .attr('x', 10)
        .attr('y', 15)
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .style('fill', color)
        .text(title);

      // Add y-axis (only left side)
      g.append('g')
        .call(d3.axisLeft(yScale).ticks(4));

      // Add y-axis label
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 15)
        .attr('x', -panelHeight / 2)
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('fill', '#666')
        .text(yAxisLabel);

      // Draw each line in the panel.
      lines.forEach((ln) => {
        const lineGen = d3.line()
          .x(d => xScale(d.day))
          .y(d => yScale(d[ln.dataKey] || 0))
          .curve(d3.curveMonotoneX);
        g.append('path')
          .datum(ln.data)
          .attr('fill', 'none')
          .attr('stroke', ln.color)
          .attr('stroke-width', 2)
          .attr('d', lineGen);
        // Data-point dots only in single-line mode (avoid clutter).
        if (!isMultiLine) {
          g.selectAll(`.data-point-${index}`)
            .data(ln.data)
            .enter().append('circle')
            .attr('class', `data-point-${index}`)
            .attr('cx', d => xScale(d.day))
            .attr('cy', d => yScale(d[ln.dataKey] || 0))
            .attr('r', 2)
            .attr('fill', ln.color)
            .attr('opacity', 0.6);
        }
      });

      // Per-panel legend in multi-line mode.
      if (isMultiLine) {
        const legendG = g.append('g')
          .attr('transform', `translate(${width - 12}, 6)`);
        lines.forEach((ln, i) => {
          const row = legendG.append('g')
            .attr('transform', `translate(0, ${i * 14})`);
          row.append('line')
            .attr('x1', -22).attr('x2', -8).attr('y1', 6).attr('y2', 6)
            .attr('stroke', ln.color).attr('stroke-width', 2);
          row.append('text')
            .attr('x', -28).attr('y', 9)
            .style('text-anchor', 'end')
            .style('font-size', '10px')
            .style('fill', '#374151')
            .text(ln.label || ln.dataKey);
        });
      }

      // Add vertical line for selected time point
      if (selectedTimePoint) {
        g.append('line')
          .attr('class', 'selected-time-line')
          .attr('x1', xScale(selectedTimePoint))
          .attr('x2', xScale(selectedTimePoint))
          .attr('y1', 0)
          .attr('y2', panelHeight)
          .attr('stroke', '#ff6b35')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,4')
          .attr('opacity', 0.8);
      }

      // Add interactive overlay for this panel
      g.append('rect')
        .attr('class', 'panel-overlay')
        .attr('width', width)
        .attr('height', panelHeight)
        .style('fill', 'transparent')
        .style('pointer-events', 'all')
        .style('cursor', 'crosshair')
        .on('mousemove', function(event) {
          const [mouseX] = d3.pointer(event);
          const day = Math.round(xScale.invert(mouseX));
          const tooltipLines = lines
            .map((ln) => {
              const dd = ln.data?.find(d => d.day === day);
              if (!dd) return null;
              const v = dd[ln.dataKey] ?? 0;
              const label = ln.label || ln.dataKey;
              return `${label}: ${typeof v === 'number' ? v.toLocaleString() : v}`;
            })
            .filter(Boolean);
          if (tooltipLines.length > 0) {
            setTooltip({
              show: true,
              x: event.pageX + 10,
              y: event.pageY - 10,
              content: `Day ${day}\n${tooltipLines.join('\n')}`
            });
          }
        })
        .on('mouseleave', () => {
          setTooltip({ show: false, x: 0, y: 0, content: '' });
        })
        .on('click', function(event) {
          const [mouseX] = d3.pointer(event);
          const day = Math.round(xScale.invert(mouseX));
          dispatch(setSelectedTimePoint(Math.max(1, Math.min(365, day))));
        });
    });

    // Add shared x-axis at bottom
    const xAxisY = seriesData.length * (panelHeight + 20);
    mainG.append('g')
      .attr('transform', `translate(0, ${xAxisY})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format('d')));

    // Add x-axis label
    mainG.append('text')
      .attr('transform', `translate(${width / 2}, ${xAxisY + 40})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Day of Year');

    // Add month labels
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthPositions = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
    
    months.forEach((month, i) => {
      mainG.append('text')
        .attr('x', xScale(monthPositions[i]))
        .attr('y', xAxisY + 60)
        .style('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#999')
        .text(month);
    });

    // Draw Application Timeline
    if (applicationData && applicationData.length > 0) {
      const timelineY = xAxisY + 70;
      const timelineG = mainG.append('g')
        .attr('transform', `translate(0, ${timelineY})`);

      // Timeline background
      timelineG.append('rect')
        .attr('width', width)
        .attr('height', applicationTimelineHeight)
        .attr('fill', '#f8f9fa')
        .attr('stroke', '#dee2e6')
        .attr('stroke-width', 1);

      // Timeline title
      timelineG.append('text')
        .attr('x', 10)
        .attr('y', 15)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', '#495057')
        .text('Application Events');

      // Group applications by day
      const applicationsByDay = d3.group(applicationData, d => d.application_day);

      // Draw application markers
      applicationsByDay.forEach((applications, day) => {
        const x = xScale(parseInt(day));
        const count = applications.length;
        
        // Application marker
        timelineG.append('circle')
          .attr('cx', x)
          .attr('cy', applicationTimelineHeight / 2 + 5)
          .attr('r', Math.min(4 + Math.log(count), 10))
          .attr('fill', '#ff6b35')
          .attr('opacity', 0.8)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1)
          .style('cursor', 'pointer')
          .on('mouseover', function(event) {
            const featuresList = applications.map(app => `Feature ${app.lulc_feature_id}`).join(', ');
            setTooltip({
              show: true,
              x: event.pageX + 10,
              y: event.pageY - 10,
              content: `Day ${day}: ${count} application(s)\n${featuresList}`
            });
          })
          .on('mouseout', () => {
            setTooltip({ show: false, x: 0, y: 0, content: '' });
          })
          .on('click', () => {
            dispatch(setSelectedTimePoint(parseInt(day)));
          });

        // Count label for multiple applications
        if (count > 1) {
          timelineG.append('text')
            .attr('x', x)
            .attr('y', applicationTimelineHeight / 2 + 8)
            .attr('text-anchor', 'middle')
            .style('font-size', '9px')
            .style('fill', 'white')
            .style('pointer-events', 'none')
            .text(count);
        }
      });
    }

  }, [seriesData, selectedTimePoint, dispatch, applicationData]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  return (
    <div className="trellis-chart-container">
      <svg ref={svgRef}></svg>
      
      {/* Tooltip */}
      {tooltip.show && (
        <div
          className="tooltip"
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'pre-line'
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

export default TrellisTimeSeriesChart;