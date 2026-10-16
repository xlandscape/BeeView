import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { select, pointer } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { axisLeft, axisBottom } from 'd3-axis';
import { line as d3Line, curveMonotoneX } from 'd3-shape';
import { extent, group } from 'd3-array';
import { setSelectedTimePoint } from '../../store/timeSlice';
import useContainerSize from '../../hooks/useContainerSize';

const TrellisTimeSeriesChart = ({
  seriesData, // Array of {data, dataKey, title, color, yAxisLabel}
  height = 400,
  applicationData = [], // Application events data
  startDate = null, // ISO "YYYY-MM-DD" string for calendar axis labels
}) => {
  const dispatch = useDispatch();
  const svgRef = useRef();
  // The chart fills its container (a resizable drawer); redraws are debounced.
  const [containerRef, { width: containerWidth }] = useContainerSize({ debounceMs: 80 });
  const selectedTimePoint = useSelector(state => state.time.selectedTimePoint);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: '' });
  // The x-scale of the last full draw, so the time cursor can be moved
  // without rebuilding the whole SVG on every time step.
  const xScaleRef = useRef(null);
  const selectedTimeRef = useRef(selectedTimePoint);
  selectedTimeRef.current = selectedTimePoint;

  const drawChart = useCallback(() => {
    if (!seriesData || seriesData.length === 0) return;
    if (!containerWidth) return; // not measured yet (hidden drawer)

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 80, bottom: 100, left: 80 };
    const width = Math.max(360, containerWidth) - margin.left - margin.right;

    // Calculate heights for trellis panels
    const applicationTimelineHeight = 40;
    const panelHeight = (height - margin.top - margin.bottom - applicationTimelineHeight - 20) / seriesData.length;
    const totalHeight = height + (seriesData.length - 1) * panelHeight;

    const mainG = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', totalHeight)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Derive total days from actual data so multi-year runs aren't clipped.
    const allDays = seriesData.flatMap(s => {
      const ls = (s.lines && s.lines.length > 0)
        ? s.lines
        : (s.data ? [{ data: s.data }] : []);
      return ls.flatMap(l => (l.data || []).map(d => d.day || 0));
    });
    const totalDays = Math.max(365, ...allDays);
    const multiYear = totalDays > 366;

    // Shared x-scale
    const xScale = scaleLinear()
      .domain([1, totalDays])
      .range([0, width]);
    xScaleRef.current = xScale;

    // Build x-axis tick descriptors
    const baseDate = startDate ? new Date(startDate + 'T00:00:00') : null;
    const dayToDate = (day) => {
      if (!baseDate) return null;
      const d = new Date(baseDate);
      d.setDate(d.getDate() + day - 1);
      return d;
    };
    const buildXTicks = () => {
      if (!multiYear) {
        // Single year: month start positions (approx)
        const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
        const MONTH_NAMES  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return MONTH_STARTS.map((day, i) => ({
          day,
          label: MONTH_NAMES[i],
          isYear: false,
        }));
      }
      // Multi-year: year labels at Jan 1 of each year + abbreviated mid-quarter marks
      const ticks = [];
      const yearCount = Math.ceil(totalDays / 365) + 1;
      for (let y = 0; y < yearCount; y++) {
        const yearStartDay = y * 365 + 1;
        if (yearStartDay > totalDays + 31) break;
        const yearLabel = baseDate
          ? String(baseDate.getFullYear() + y)
          : `Year ${y + 1}`;
        ticks.push({ day: yearStartDay, label: yearLabel, isYear: true });
        // Add quarterly month marks within each year for readability
        [91, 182, 274].forEach(offset => {
          const day = yearStartDay + offset - 1;
          if (day <= totalDays) {
            const d = dayToDate(day);
            const mLabel = d
              ? d.toLocaleString('en', { month: 'short' })
              : ['Apr','Jul','Oct'][([91,182,274].indexOf(offset))];
            ticks.push({ day, label: mLabel, isYear: false });
          }
        });
      }
      return ticks;
    };

    const initialCursorDay = selectedTimeRef.current;

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
      const yScale = scaleLinear()
        .domain(extent(allValues))
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
        .call(axisLeft(yScale).ticks(4));

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
        const lineGen = d3Line()
          .x(d => xScale(d.day))
          .y(d => yScale(d[ln.dataKey] || 0))
          .curve(curveMonotoneX);
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

      // Vertical line for the selected time point. Always present; positioned
      // and shown/hidden by the cursor effect below so time changes don't redraw.
      g.append('line')
        .attr('class', 'selected-time-line')
        .attr('x1', xScale(initialCursorDay || 1))
        .attr('x2', xScale(initialCursorDay || 1))
        .attr('y1', 0)
        .attr('y2', panelHeight)
        .attr('stroke', '#ff6b35')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.8)
        .style('display', initialCursorDay ? null : 'none');

      // Day -> datum lookup per line, so hovering is O(1) instead of a scan per event.
      const lookups = lines.map((ln) => {
        const byDay = new Map();
        (ln.data || []).forEach((d) => byDay.set(d.day, d));
        return byDay;
      });

      // Add interactive overlay for this panel
      g.append('rect')
        .attr('class', 'panel-overlay')
        .attr('width', width)
        .attr('height', panelHeight)
        .style('fill', 'transparent')
        .style('pointer-events', 'all')
        .style('cursor', 'crosshair')
        .on('mousemove', function(event) {
          const [mouseX] = pointer(event);
          const day = Math.round(xScale.invert(mouseX));
          const tooltipLines = lines
            .map((ln, i) => {
              const dd = lookups[i].get(day);
              if (!dd) return null;
              const v = dd[ln.dataKey] ?? 0;
              const label = ln.label || ln.dataKey;
              return `${label}: ${typeof v === 'number' ? v.toLocaleString() : v}`;
            })
            .filter(Boolean);
          if (tooltipLines.length > 0) {
            setTooltip({
              show: true,
              x: event.clientX + 10,
              y: event.clientY - 10,
              content: `Day ${day}\n${tooltipLines.join('\n')}`
            });
          }
        })
        .on('mouseleave', () => {
          setTooltip({ show: false, x: 0, y: 0, content: '' });
        })
        .on('click', function(event) {
          const [mouseX] = pointer(event);
          const day = Math.round(xScale.invert(mouseX));
          dispatch(setSelectedTimePoint(Math.max(1, Math.min(totalDays, day))));
        });
    });

    // Add shared x-axis at bottom
    const xAxisY = seriesData.length * (panelHeight + 20);
    const xTicks = buildXTicks();

    // Draw a minimal numeric axis line only
    mainG.append('g')
      .attr('transform', `translate(0, ${xAxisY})`)
      .call(
        axisBottom(xScale)
          .tickValues(xTicks.filter(t => t.isYear || !multiYear).map(t => t.day))
          .tickFormat(() => '')
      );

    // Add x-axis label
    mainG.append('text')
      .attr('transform', `translate(${width / 2}, ${xAxisY + 40})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(multiYear ? 'Simulation Day' : 'Day of Year');

    // Draw custom tick labels
    xTicks.forEach(tick => {
      const x = xScale(tick.day);
      if (tick.isYear && multiYear) {
        // Year separator + bold label
        mainG.append('line')
          .attr('x1', x).attr('x2', x)
          .attr('y1', xAxisY).attr('y2', xAxisY + 14)
          .attr('stroke', '#666').attr('stroke-width', 1.5);
        mainG.append('text')
          .attr('x', x).attr('y', xAxisY + 26)
          .style('text-anchor', 'middle')
          .style('font-size', '12px')
          .style('font-weight', 'bold')
          .style('fill', '#333')
          .text(tick.label);
      } else {
        mainG.append('text')
          .attr('x', x).attr('y', xAxisY + (multiYear ? 48 : 60))
          .style('text-anchor', 'middle')
          .style('font-size', '10px')
          .style('fill', '#999')
          .text(tick.label);
      }
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

      const applicationsByDay = Array.from(
        group(applicationData, d => d.application_day),
        ([day, applications]) => ({
          day: parseInt(day, 10),
          groups: Array.from(
            group(applications, d => d.run_label || 'Default scenario'),
            ([runLabel, runApplications]) => ({
              runLabel,
              runId: runApplications[0]?.run_id ?? null,
              color: runApplications[0]?.color || '#ff6b35',
              applications: runApplications,
            })
          ),
        })
      ).sort((a, b) => a.day - b.day);

      applicationsByDay.forEach(({ day, groups }) => {
        const x = xScale(day);
        const spacing = 12;
        const startX = x - ((groups.length - 1) * spacing) / 2;

        groups.forEach((grp, groupIndex) => {
          const groupX = startX + groupIndex * spacing;
          const count = grp.applications.length;

          timelineG.append('circle')
            .attr('cx', groupX)
            .attr('cy', applicationTimelineHeight / 2 + 5)
            .attr('r', Math.min(4 + Math.log(count), 10))
            .attr('fill', grp.color)
            .attr('opacity', 0.85)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .style('cursor', 'pointer')
            .on('mouseover', function(event) {
              const featuresList = grp.applications
                .map(app => `Feature ${app.lulc_feature_id}`)
                .join(', ');
              setTooltip({
                show: true,
                x: event.clientX + 10,
                y: event.clientY - 10,
                content: `Day ${day} • ${grp.runLabel}: ${count} application(s)\n${featuresList}`
              });
            })
            .on('mouseout', () => {
              setTooltip({ show: false, x: 0, y: 0, content: '' });
            })
            .on('click', () => {
              dispatch(setSelectedTimePoint(day));
            });

          if (count > 1) {
            timelineG.append('text')
              .attr('x', groupX)
              .attr('y', applicationTimelineHeight / 2 + 8)
              .attr('text-anchor', 'middle')
              .style('font-size', '9px')
              .style('fill', 'white')
              .style('pointer-events', 'none')
              .text(count);
          }
        });
      });
    }

  }, [seriesData, height, startDate, dispatch, applicationData, containerWidth]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // Move the time cursor in place when the selected day changes.
  useEffect(() => {
    const xScale = xScaleRef.current;
    if (!xScale || !svgRef.current) return;
    const x = selectedTimePoint ? xScale(selectedTimePoint) : 0;
    select(svgRef.current)
      .selectAll('.selected-time-line')
      .attr('x1', x)
      .attr('x2', x)
      .style('display', selectedTimePoint ? null : 'none');
  }, [selectedTimePoint, seriesData]);

  return (
    <div className="trellis-chart-container" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef}></svg>

      {/* Tooltip: viewport coordinates, so it is right inside scrolling overlays */}
      {tooltip.show && (
        <div
          className="tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 2000,
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
