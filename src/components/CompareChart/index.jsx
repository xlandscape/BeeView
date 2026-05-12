import React, { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { buildApiUrl } from '../../config/api';
import './CompareChart.css';

const RELATIVE_HEIGHT = 320;
const EXCEEDANCE_HEIGHT = 200;
const MARGIN = { top: 20, right: 24, bottom: 32, left: 56 };

function buildPath(points) {
  if (!points.length) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ');
}

function buildBandPath(upper, lower) {
  // Draws a closed polygon for the p10..p90 band.
  const upperPath = upper.map(([x, y], i) =>
    `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`,
  );
  const lowerPath = [...lower]
    .reverse()
    .map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`);
  return [...upperPath, ...lowerPath, 'Z'].join(' ');
}

function niceDomain(values, padFraction = 0.05) {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return [-1, 1];
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (min === max) {
    const pad = Math.abs(min) * padFraction || 0.1;
    min -= pad;
    max += pad;
  } else {
    const span = max - min;
    min -= span * padFraction;
    max += span * padFraction;
  }
  return [min, max];
}

function makeScales(width, height, xDomain, yDomain) {
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const xScale = (x) => MARGIN.left + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * innerW;
  const yScale = (y) => MARGIN.top + (1 - (y - yDomain[0]) / (yDomain[1] - yDomain[0])) * innerH;
  return { xScale, yScale, innerW, innerH };
}

function YAxis({ yDomain, yScale, label, format = (v) => v.toFixed(2) }) {
  const ticks = 5;
  const step = (yDomain[1] - yDomain[0]) / (ticks - 1);
  const tickValues = Array.from({ length: ticks }, (_, i) => yDomain[0] + i * step);
  return (
    <g className="axis y-axis">
      <line
        x1={MARGIN.left}
        x2={MARGIN.left}
        y1={yScale(yDomain[1])}
        y2={yScale(yDomain[0])}
        stroke="#999"
      />
      {tickValues.map((v) => (
        <g key={v}>
          <line
            x1={MARGIN.left - 4}
            x2={MARGIN.left}
            y1={yScale(v)}
            y2={yScale(v)}
            stroke="#999"
          />
          <text
            x={MARGIN.left - 8}
            y={yScale(v)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="10"
            fill="#555"
          >
            {format(v)}
          </text>
        </g>
      ))}
      {label && (
        <text
          transform={`translate(14, ${(yScale(yDomain[0]) + yScale(yDomain[1])) / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize="11"
          fill="#333"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function XAxis({ xDomain, xScale, height }) {
  const ticks = 12;
  const step = (xDomain[1] - xDomain[0]) / ticks;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => Math.round(xDomain[0] + i * step));
  const y = height - MARGIN.bottom;
  return (
    <g className="axis x-axis">
      <line x1={MARGIN.left} x2={xScale(xDomain[1])} y1={y} y2={y} stroke="#999" />
      {tickValues.map((v) => (
        <g key={v}>
          <line x1={xScale(v)} x2={xScale(v)} y1={y} y2={y + 4} stroke="#999" />
          <text x={xScale(v)} y={y + 16} textAnchor="middle" fontSize="10" fill="#555">
            {v}
          </text>
        </g>
      ))}
      <text
        x={(MARGIN.left + xScale(xDomain[1])) / 2}
        y={y + 28}
        textAnchor="middle"
        fontSize="11"
        fill="#333"
      >
        Day of year
      </text>
    </g>
  );
}

function RelativePanel({ days, mean, p10, p50, p90, width, threshold }) {
  if (!days || days.length === 0) return null;
  const allValues = [...mean, ...p10, ...p90].filter((v) => Number.isFinite(v));
  const yDomain = niceDomain([...allValues, -threshold, threshold]);
  const xDomain = [days[0], days[days.length - 1]];
  const { xScale, yScale, innerW, innerH } = makeScales(width, RELATIVE_HEIGHT, xDomain, yDomain);

  const upperPts = days.map((d, i) => [xScale(d), yScale(p90[i] ?? mean[i] ?? 0)]);
  const lowerPts = days.map((d, i) => [xScale(d), yScale(p10[i] ?? mean[i] ?? 0)]);
  const meanPts = days.map((d, i) => [xScale(d), yScale(mean[i] ?? 0)]);
  const p50Pts = days.map((d, i) => [xScale(d), yScale(p50[i] ?? 0)]);
  const zeroY = yScale(0);
  const posThresholdY = yScale(threshold);
  const negThresholdY = yScale(-threshold);

  return (
    <svg width={width} height={RELATIVE_HEIGHT} className="compare-panel">
      <rect
        x={MARGIN.left}
        y={MARGIN.top}
        width={innerW}
        height={innerH}
        fill="#fafafa"
        stroke="#eee"
      />
      {/* p10..p90 band */}
      <path d={buildBandPath(upperPts, lowerPts)} fill="rgba(37, 99, 235, 0.18)" stroke="none" />
      {/* zero baseline */}
      <line
        x1={MARGIN.left}
        x2={xScale(xDomain[1])}
        y1={zeroY}
        y2={zeroY}
        stroke="#777"
        strokeDasharray="4 3"
      />
      {/* threshold ±10% */}
      <line
        x1={MARGIN.left}
        x2={xScale(xDomain[1])}
        y1={posThresholdY}
        y2={posThresholdY}
        stroke="#dc2626"
        strokeDasharray="2 4"
      />
      <line
        x1={MARGIN.left}
        x2={xScale(xDomain[1])}
        y1={negThresholdY}
        y2={negThresholdY}
        stroke="#dc2626"
        strokeDasharray="2 4"
      />
      {/* p50 (median) */}
      <path d={buildPath(p50Pts)} fill="none" stroke="rgba(29, 78, 216, 0.6)" strokeWidth="1.5" />
      {/* mean */}
      <path d={buildPath(meanPts)} fill="none" stroke="#1d4ed8" strokeWidth="2" />
      <YAxis
        yDomain={yDomain}
        yScale={yScale}
        label="(scenario − baseline) / baseline"
        format={(v) => `${(v * 100).toFixed(0)}%`}
      />
      <XAxis xDomain={xDomain} xScale={xScale} height={RELATIVE_HEIGHT} />
    </svg>
  );
}

function ExceedancePanel({ days, fractions, width, threshold }) {
  if (!days || days.length === 0) return null;
  const yDomain = [0, 1];
  const xDomain = [days[0], days[days.length - 1]];
  const { xScale, yScale, innerW, innerH } = makeScales(width, EXCEEDANCE_HEIGHT, xDomain, yDomain);
  const linePts = days.map((d, i) => [xScale(d), yScale(fractions[i] ?? 0)]);
  const baseY = yScale(0);
  const areaPath = [
    `M${linePts[0][0].toFixed(1)},${baseY.toFixed(1)}`,
    ...linePts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`),
    `L${linePts[linePts.length - 1][0].toFixed(1)},${baseY.toFixed(1)}`,
    'Z',
  ].join(' ');

  return (
    <svg width={width} height={EXCEEDANCE_HEIGHT} className="compare-panel">
      <rect
        x={MARGIN.left}
        y={MARGIN.top}
        width={innerW}
        height={innerH}
        fill="#fafafa"
        stroke="#eee"
      />
      <path d={areaPath} fill="rgba(220, 38, 38, 0.25)" stroke="none" />
      <path d={buildPath(linePts)} fill="none" stroke="#b91c1c" strokeWidth="2" />
      <YAxis
        yDomain={yDomain}
        yScale={yScale}
        label={`fraction of pairs Δ<=-${(threshold * 100).toFixed(0)}%`}
        format={(v) => `${(v * 100).toFixed(0)}%`}
      />
      <XAxis xDomain={xDomain} xScale={xScale} height={EXCEEDANCE_HEIGHT} />
    </svg>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Map exceedance fraction 0-1 to a CSS colour string. */
function exceedanceColor(f) {
  if (!Number.isFinite(f) || f <= 0) return '#f0fdf4';
  if (f < 0.10) return '#fef9c3';
  if (f < 0.25) return '#fde68a';
  if (f < 0.50) return '#fb923c';
  if (f < 0.75) return '#ef4444';
  return '#7f1d1d';
}

/** Text colour for contrast on the cell background. */
function cellTextColor(f) {
  return f >= 0.50 ? '#fff' : '#1f2937';
}

/** Format exceedance fraction as "xx%" */
function fmtPct(v) {
  if (!Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

function formatMatrixTooltip({ spatialPercentile, temporalPercentile, value, threshold }) {
  const thresholdPct = (threshold * 100).toFixed(0);
  const valuePct = fmtPct(value);
  return [
    `Spatial p${spatialPercentile} x Temporal p${temporalPercentile}: ${valuePct}`,
    '',
    `Interpretation: for ${spatialPercentile}% of hive locations, the temporal p${temporalPercentile}`,
    `of daily exceedance is at or below ${valuePct}.`,
    '',
    `Here, daily exceedance means the fraction of replicate pairs where treated colony size`,
    `is reduced by at least ${thresholdPct}% relative to untreated.`,
  ].join('\n');
}

/**
 * A tiny inline sparkline as an SVG element.
 * data: number[] of values in [0, 1]
 */
function Sparkline({ data, w = 100, h = 28 }) {
  if (!data || data.length < 2) return <span style={{ color: '#9ca3af', fontSize: 10 }}>—</span>;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - v * h).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline
        points={pts}
        fill="none"
        stroke="#dc2626"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* zero line */}
      <line x1={0} x2={w} y1={h} y2={h} stroke="#e5e7eb" strokeWidth="0.5" />
      {/* 10% reference */}
      <line x1={0} x2={w} y1={h * 0.9} y2={h * 0.9} stroke="#fde68a" strokeWidth="0.5"
        strokeDasharray="2 2" />
    </svg>
  );
}

/**
 * Multi-year-aware x tick generator. Returns [{day, label}] for chart axes.
 * startDate: JS Date or null.
 */
function buildAxisTicks(totalDays, startDate) {
  const multiYear = totalDays > 366;
  if (!multiYear) {
    const STARTS = [1,32,60,91,121,152,182,213,244,274,305,335];
    const NAMES  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return STARTS.map((d, i) => ({ day: d, label: NAMES[i], isYear: false }));
  }
  const ticks = [];
  const years = Math.floor(totalDays / 365);
  for (let y = 0; y < years; y++) {
    const dayStart = y * 365 + 1;
    if (dayStart > totalDays) break;
    const yr = startDate ? String(startDate.getFullYear() + y) : `Y${y + 1}`;
    ticks.push({ day: dayStart, label: yr, isYear: true });
    [91, 182, 274].forEach((off) => {
      const d = dayStart + off - 1;
      if (d <= totalDays) {
        const mo = startDate
          ? new Date(startDate.getTime() + (d - 1) * 86400000)
              .toLocaleString('en', { month: 'short' })
          : ['Apr','Jul','Oct'][[91,182,274].indexOf(off)];
        ticks.push({ day: d, label: mo, isYear: false });
      }
    });
  }
  return ticks;
}

// ─── Spatial percentile band chart ──────────────────────────────────────────

const SPAT_H = 180;
const SPAT_M = { top: 16, right: 20, bottom: 52, left: 56 };

function SpatialBandChart({ days, p10, p50, p90, width, simStart }) {
  if (!days || days.length === 0) return null;
  const innerW = width - SPAT_M.left - SPAT_M.right;
  const innerH = SPAT_H - SPAT_M.top - SPAT_M.bottom;

  const xS = (d) => SPAT_M.left + ((d - days[0]) / (days[days.length - 1] - days[0])) * innerW;
  const yS = (v) => SPAT_M.top + (1 - v) * innerH;

  const bandUpper = days.map((d, i) => `${i === 0 ? 'M' : 'L'}${xS(d).toFixed(1)},${yS(p90[i] ?? 0).toFixed(1)}`);
  const bandLower = [...days].reverse().map((d, i, arr) => {
    const idx = days.length - 1 - i;
    return `L${xS(d).toFixed(1)},${yS(p10[idx] ?? 0).toFixed(1)}`;
  });
  const bandPath = [...bandUpper, ...bandLower, 'Z'].join(' ');
  const p50Path = days.map((d, i) => `${i === 0 ? 'M' : 'L'}${xS(d).toFixed(1)},${yS(p50[i] ?? 0).toFixed(1)}`).join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];
  const startDate = simStart ? new Date(simStart + 'T00:00:00') : null;
  const xTicks = buildAxisTicks(days[days.length - 1], startDate);
  const multiYear = days[days.length - 1] > 366;

  return (
    <svg width={width} height={SPAT_H} className="compare-panel">
      <rect x={SPAT_M.left} y={SPAT_M.top} width={innerW} height={innerH}
        fill="#fafafa" stroke="#e5e7eb" />
      {/* y grid lines */}
      {yTicks.map(v => (
        <line key={v} x1={SPAT_M.left} x2={SPAT_M.left + innerW}
          y1={yS(v)} y2={yS(v)} stroke="#e5e7eb" strokeDasharray={v === 0 ? '' : '3 3'} />
      ))}
      {/* p10–p90 band */}
      <path d={bandPath} fill="rgba(220,38,38,0.15)" stroke="none" />
      {/* p50 line */}
      <path d={p50Path} fill="none" stroke="#b91c1c" strokeWidth="2" />

      {/* y axis */}
      <line x1={SPAT_M.left} x2={SPAT_M.left} y1={SPAT_M.top}
        y2={SPAT_M.top + innerH} stroke="#999" />
      {yTicks.map(v => (
        <g key={v}>
          <line x1={SPAT_M.left - 4} x2={SPAT_M.left} y1={yS(v)} y2={yS(v)} stroke="#999" />
          <text x={SPAT_M.left - 7} y={yS(v)} textAnchor="end" dominantBaseline="middle"
            fontSize="10" fill="#555">{`${(v * 100).toFixed(0)}%`}</text>
        </g>
      ))}
      <text transform={`translate(14,${SPAT_M.top + innerH / 2}) rotate(-90)`}
        textAnchor="middle" fontSize="10" fill="#374151">exceedance fraction</text>

      {/* x axis ticks */}
      <line x1={SPAT_M.left} x2={SPAT_M.left + innerW}
        y1={SPAT_M.top + innerH} y2={SPAT_M.top + innerH} stroke="#999" />
      {xTicks.map(({ day, label, isYear }) => {
        const x = xS(day);
        if (x < SPAT_M.left || x > SPAT_M.left + innerW) return null;
        return (
          <g key={`${day}-${label}`}>
            <line x1={x} x2={x} y1={SPAT_M.top + innerH} y2={SPAT_M.top + innerH + (isYear && multiYear ? 8 : 4)}
              stroke={isYear && multiYear ? '#666' : '#bbb'} strokeWidth={isYear && multiYear ? 1.5 : 1} />
            <text x={x} y={SPAT_M.top + innerH + (multiYear ? (isYear ? 20 : 38) : 18)}
              textAnchor="middle" fontSize={isYear ? 11 : 9}
              fontWeight={isYear && multiYear ? 'bold' : 'normal'}
              fill={isYear && multiYear ? '#333' : '#999'}>{label}</text>
          </g>
        );
      })}

      {/* legend */}
      <rect x={SPAT_M.left + innerW - 110} y={SPAT_M.top + 6} width={106} height={38}
        fill="white" stroke="#e5e7eb" rx="3" />
      <line x1={SPAT_M.left + innerW - 104} x2={SPAT_M.left + innerW - 84}
        y1={SPAT_M.top + 17} y2={SPAT_M.top + 17} stroke="#b91c1c" strokeWidth="2" />
      <text x={SPAT_M.left + innerW - 80} y={SPAT_M.top + 20} fontSize="9" fill="#374151">median across hives</text>
      <rect x={SPAT_M.left + innerW - 104} y={SPAT_M.top + 27} width={20} height={10}
        fill="rgba(220,38,38,0.15)" stroke="rgba(220,38,38,0.3)" />
      <text x={SPAT_M.left + innerW - 80} y={SPAT_M.top + 35} fontSize="9" fill="#374151">p10 – p90 range</text>
    </svg>
  );
}

// ─── Hive matrix table ────────────────────────────────────────────────────────

/**
 * Downsample an array to at most `maxPts` points by averaging buckets.
 * Returns Float32Array.
 */
function downsample(arr, maxPts) {
  if (arr.length <= maxPts) return arr;
  const bucketSize = arr.length / maxPts;
  const out = [];
  for (let i = 0; i < maxPts; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    let sum = 0, cnt = 0;
    for (let j = start; j < end; j++) { sum += arr[j]; cnt++; }
    out.push(cnt > 0 ? sum / cnt : 0);
  }
  return out;
}

function HiveRow({ row, dailyRow, simStart }) {
  const exc = dailyRow?.exceedance;
  const sparkData = exc ? downsample(exc, 120) : null;
  const temporalPercentiles = [10, 20, 30, 40, 50, 60, 70, 80, 90];

  // If multi-year, also compute year-by-year temporal p50
  let yearCols = null;
  if (exc && exc.length > 366) {
    const nYears = Math.floor(exc.length / 365);
    yearCols = Array.from({ length: nYears }, (_, y) => {
      const slice = exc.slice(y * 365, (y + 1) * 365);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const yr = simStart
        ? String(new Date(simStart + 'T00:00:00').getFullYear() + y)
        : `Y${y + 1}`;
      return { yr, mean };
    });
  }

  return (
    <tr className="compare-matrix-row">
      <td className="compare-matrix-hive">{row.hive_group_id || `${row.baseline_id}`}</td>
      {/* temporal percentiles */}
      {temporalPercentiles.map((p) => {
        const pk = `p${p}`;
        const v = row[pk] ?? NaN;
        return (
          <td key={pk} className="compare-matrix-cell"
            style={{ background: exceedanceColor(v), color: cellTextColor(v) }}>
            {fmtPct(v)}
          </td>
        );
      })}
      {/* per-year means (only shown in multi-year mode) */}
      {yearCols && yearCols.map(({ yr, mean }) => (
        <td key={yr} className="compare-matrix-cell"
          style={{ background: exceedanceColor(mean), color: cellTextColor(mean) }}>
          {fmtPct(mean)}
        </td>
      ))}
      {/* sparkline */}
      <td className="compare-matrix-sparkline">
        <Sparkline data={sparkData} w={110} h={28} />
      </td>
    </tr>
  );
}

function PercentileMatrix({ data, threshold, simStart }) {
  const temporalRows = data?.temporal?.per_hive || [];
  const dailyRows    = data?.per_hive_daily || [];
  const spatialDays  = data?.days || [];
  const spatialPerDay = data?.spatial?.per_day || {};
  const temporalPercentiles = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const [chartWidth, setChartWidth] = React.useState(860);

  const percentileOf = (arr, p) => {
    const v = (arr || []).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return NaN;
    if (v.length === 1) return v[0];
    const idx = (p / 100) * (v.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    const t = idx - lo;
    return v[lo] * (1 - t) + v[hi] * t;
  };

  React.useEffect(() => {
    const el = document.querySelector('.compare-matrix-wrap');
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setChartWidth(Math.max(500, el.clientWidth - 4));
    });
    obs.observe(el);
    setChartWidth(Math.max(500, el.clientWidth - 4));
    return () => obs.disconnect();
  }, []);

  if (temporalRows.length === 0) {
    return <div className="compare-status">No paired run data available for matrix view.</div>;
  }

  // Build year column headers if multi-year
  const firstExc = dailyRows[0]?.exceedance;
  const nYears = firstExc && firstExc.length > 366 ? Math.floor(firstExc.length / 365) : 0;
  const yearLabels = nYears > 0
    ? Array.from({ length: nYears }, (_, y) =>
        simStart
          ? String(new Date(simStart + 'T00:00:00').getFullYear() + y)
          : `Y${y + 1}`
      )
    : [];

  // Spatial summary scalars (mean of per-day percentile series across all days)
  const spatP10 = spatialPerDay.p10;
  const spatP50 = spatialPerDay.p50;
  const spatP90 = spatialPerDay.p90;
  const mean = (arr) => arr ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;
  const spatialTemporalMeans = temporalPercentiles.map((p) => mean(spatialPerDay[`p${p}`]));

  // Matrix values: temporal decile (row) × spatial decile across hives (column).
  // For each temporal percentile pT, collect pT from every hive, then compute spatial pS.
  const temporalSpatialMatrix = temporalPercentiles.map((pT) => {
    const perHiveAtTemporal = temporalRows
      .map((r) => r?.[`p${pT}`])
      .filter((x) => Number.isFinite(x));
    return temporalPercentiles.map((pS) => percentileOf(perHiveAtTemporal, pS));
  });

  // Annual means, as percentiles across hive locations for each year.
  // annualSpatialMatrix[rowTemporalIdx][yearIdx]
  const annualSpatialMatrix = temporalPercentiles.map((pT) =>
    yearLabels.map((_, y) => {
      const perHiveAnnualMeans = dailyRows
        .map((d) => d?.exceedance)
        .map((exc) => {
          if (!exc || exc.length < (y + 1) * 365) return NaN;
          const slice = exc.slice(y * 365, (y + 1) * 365);
          return mean(slice);
        })
        .filter((x) => Number.isFinite(x));
      return percentileOf(perHiveAnnualMeans, pT);
    }),
  );

  // Display orientation requested by user:
  // rows = spatial percentiles, columns = temporal percentiles.
  const spatialTemporalDisplayMatrix = temporalPercentiles.map((pS, sIdx) =>
    temporalPercentiles.map((pT, tIdx) => temporalSpatialMatrix[tIdx][sIdx]),
  );

  // Annual display matrix with same orientation: rows = spatial percentiles.
  const annualBySpatialMatrix = temporalPercentiles.map((pS) =>
    yearLabels.map((_, y) => {
      const perHiveAnnualMeans = dailyRows
        .map((d) => d?.exceedance)
        .map((exc) => {
          if (!exc || exc.length < (y + 1) * 365) return NaN;
          const slice = exc.slice(y * 365, (y + 1) * 365);
          return mean(slice);
        })
        .filter((x) => Number.isFinite(x));
      return percentileOf(perHiveAnnualMeans, pS);
    }),
  );

  const temporalColumnMeans = temporalPercentiles.map((_, colIdx) =>
    mean(
      spatialTemporalDisplayMatrix
        .map((row) => row[colIdx])
        .filter((x) => Number.isFinite(x)),
    ),
  );

  const annualColumnMeans = yearLabels.map((_, y) =>
    mean(
      annualBySpatialMatrix
        .map((row) => row[y])
        .filter((x) => Number.isFinite(x)),
    ),
  );

  return (
    <div className="compare-matrix-wrap">
      {/* ── Section title ── */}
      <div className="compare-section-title">
        Spatial percentiles across hive locations — decline threshold {(threshold * 100).toFixed(0)}%
      </div>

      {/* ── Spatial band chart ── */}
      {spatialDays.length > 0 && spatP50 && (
        <SpatialBandChart
          days={spatialDays}
          p10={spatP10 || []}
          p50={spatP50}
          p90={spatP90 || []}
          width={chartWidth}
          simStart={simStart}
        />
      )}

      {/* ── Matrix table ── */}
      <div className="compare-section-title" style={{ marginTop: 16 }}>
        Temporal × spatial percentile matrix — fraction of days exceeding decline threshold
      </div>
      <div className="compare-matrix-scroll">
        <table className="compare-matrix-table">
          <thead>
            <tr>
              <th rowSpan={2} className="compare-matrix-hive-header">Spatial percentile</th>
              <th colSpan={temporalPercentiles.length} className="compare-matrix-group-header">
                Temporal percentiles across days
              </th>
              {nYears > 0 && (
                <th colSpan={nYears} className="compare-matrix-group-header">
                  Annual mean exceedance (full years only)
                </th>
              )}
            </tr>
            <tr>
              {temporalPercentiles.map((p) => (
                <th key={`head-p${p}`} className="compare-matrix-pct-header">
                  {p === 50 ? 'temporal p50' : `temporal p${p}`}
                </th>
              ))}
              {yearLabels.map(yr => (
                <th key={yr} className="compare-matrix-pct-header">{yr}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {temporalPercentiles.map((pS, rowIdx) => (
              <tr key={`srow-${pS}`} className="compare-matrix-row">
                <td className="compare-matrix-hive" style={{ fontWeight: 600 }}>
                  {pS === 50 ? 'spatial p50 (median)' : `spatial p${pS}`}
                </td>
                {spatialTemporalDisplayMatrix[rowIdx].map((v, colIdx) => (
                  <td
                    key={`cell-${pS}-${colIdx}`}
                    className="compare-matrix-cell"
                    style={{ background: exceedanceColor(v), color: cellTextColor(v) }}
                    title={formatMatrixTooltip({
                      spatialPercentile: pS,
                      temporalPercentile: temporalPercentiles[colIdx],
                      value: v,
                      threshold,
                    })}
                  >
                    {fmtPct(v)}
                  </td>
                ))}
                {annualBySpatialMatrix[rowIdx].map((v, y) => (
                  <td
                    key={`ann-${pS}-${y}`}
                    className="compare-matrix-cell"
                    style={{ background: exceedanceColor(v), color: cellTextColor(v) }}
                    title={`year ${yearLabels[y]} · spatial p${pS}`}
                  >
                    {fmtPct(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            {/* Spatial summary row */}
            <tr className="compare-matrix-summary-row">
              <td className="compare-matrix-hive" style={{ fontStyle: 'italic' }}>
                Mean over spatial rows
              </td>
              {temporalColumnMeans.map((v, idx) => (
                <td key={`sp-summary-${idx}`} className="compare-matrix-cell compare-matrix-summary-cell"
                  style={{ background: exceedanceColor(v), color: cellTextColor(v) }}>
                  {fmtPct(v)}
                </td>
              ))}
              {annualColumnMeans.map((v, y) => {
                return (
                <td key={y} className="compare-matrix-cell compare-matrix-summary-cell"
                  style={{ background: exceedanceColor(v), color: cellTextColor(v) }}>
                  {fmtPct(v)}
                </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Colour scale legend ── */}
      <div className="compare-matrix-legend">
        <span className="compare-matrix-legend-label">Exceedance fraction:</span>
        {[
          { lo: 0,    hi: 0.10, bg: '#fef9c3', label: '< 10%' },
          { lo: 0.10, hi: 0.25, bg: '#fde68a', label: '10–25%' },
          { lo: 0.25, hi: 0.50, bg: '#fb923c', label: '25–50%' },
          { lo: 0.50, hi: 0.75, bg: '#ef4444', label: '50–75%' },
          { lo: 0.75, hi: 1,    bg: '#7f1d1d', label: '> 75%' },
        ].map(({ bg, label }) => (
          <span key={label} className="compare-matrix-legend-swatch"
            style={{ background: bg, color: cellTextColor(bg === '#7f1d1d' ? 1 : 0) }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Effect-Days (ED) percentile matrix heatmap ─────────────────────────────

/** Map an ED value (0..maxDays) to a CSS colour. */
function edColor(value, maxDays) {
  if (!Number.isFinite(value) || value <= 0) return '#f0fdf4';
  const ratio = Math.min(value / Math.max(maxDays, 1), 1);
  // Linear ramp: green → yellow → orange → red → dark-red
  if (ratio < 0.15) return '#dcfce7';
  if (ratio < 0.30) return '#fef9c3';
  if (ratio < 0.50) return '#fde68a';
  if (ratio < 0.70) return '#fb923c';
  if (ratio < 0.85) return '#ef4444';
  return '#7f1d1d';
}

function edTextColor(value, maxDays) {
  const ratio = Math.min(value / Math.max(maxDays, 1), 1);
  return ratio >= 0.70 ? '#fff' : '#1f2937';
}

function EDMatrix({ data }) {
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: '' });

  if (!data || !data.matrix || data.matrix.length === 0) return null;

  const { matrix, temporal_percentiles, spatial_percentiles, n_days, n_hives, n_replicates, threshold } = data;
  const maxVal = Math.max(...matrix.flat());

  return (
    <div className="compare-matrix-wrap" style={{ marginTop: 24 }}>
      <div className="compare-section-title">
        Effect-Days Matrix — decline threshold {((threshold || 0.10) * 100).toFixed(0)}%
        <span style={{ fontWeight: 'normal', fontSize: 11, marginLeft: 12, color: '#6b7280' }}>
          ({n_hives} location{n_hives !== 1 ? 's' : ''} · {n_replicates} replicate{n_replicates !== 1 ? 's' : ''} · {n_days} days)
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
        Each cell shows the number of days the treated metric falls below the untreated metric by ≥{((threshold || 0.10) * 100).toFixed(0)}%.
        Rows = temporal percentiles (across replicates); Columns = spatial percentiles (across locations).
      </div>
      <div className="compare-matrix-scroll">
        <table className="compare-matrix-table" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '4px 6px' }}>
                Temporal ↓ / Spatial →
              </th>
              {spatial_percentiles.map((sp) => (
                <th key={sp} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '4px 6px', minWidth: 44, textAlign: 'center' }}>
                  p{sp}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, tIdx) => (
              <tr key={tIdx}>
                <td style={{
                  background: temporal_percentiles[tIdx] === 50 ? '#eff6ff' : '#f9fafb',
                  border: '1px solid #e5e7eb',
                  padding: '4px 6px',
                  fontWeight: temporal_percentiles[tIdx] === 50 ? 'bold' : 'normal',
                }}>
                  p{temporal_percentiles[tIdx]}
                </td>
                {row.map((val, sIdx) => {
                  const bg = edColor(val, n_days);
                  const fg = edTextColor(val, n_days);
                  const isMedianRow = temporal_percentiles[tIdx] === 50;
                  const isMedianCol = spatial_percentiles[sIdx] === 50;
                  return (
                    <td
                      key={sIdx}
                      style={{
                        background: bg,
                        color: fg,
                        border: '1px solid #e5e7eb',
                        padding: '3px 4px',
                        textAlign: 'center',
                        fontWeight: (isMedianRow || isMedianCol) ? 'bold' : 'normal',
                        cursor: 'default',
                      }}
                      onMouseEnter={(e) => setTooltip({
                        show: true,
                        x: e.clientX + 12,
                        y: e.clientY - 10,
                        content: `Temporal p${temporal_percentiles[tIdx]} × Spatial p${spatial_percentiles[sIdx]}: ${val.toFixed(1)} effect days out of ${n_days}`,
                      })}
                      onMouseLeave={() => setTooltip({ show: false, x: 0, y: 0, content: '' })}
                    >
                      {Number.isInteger(val) ? val : val.toFixed(1)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Colour scale legend */}
      <div className="compare-matrix-legend" style={{ marginTop: 8 }}>
        <span className="compare-matrix-legend-label">Effect days:</span>
        {[
          { threshold: 0.15, bg: '#dcfce7', label: `< ${Math.round(n_days * 0.15)}` },
          { threshold: 0.30, bg: '#fef9c3', label: `${Math.round(n_days * 0.15)}–${Math.round(n_days * 0.30)}` },
          { threshold: 0.50, bg: '#fde68a', label: `${Math.round(n_days * 0.30)}–${Math.round(n_days * 0.50)}` },
          { threshold: 0.70, bg: '#fb923c', label: `${Math.round(n_days * 0.50)}–${Math.round(n_days * 0.70)}` },
          { threshold: 0.85, bg: '#ef4444', label: `${Math.round(n_days * 0.70)}–${Math.round(n_days * 0.85)}` },
          { threshold: 1.0, bg: '#7f1d1d', label: `> ${Math.round(n_days * 0.85)}` },
        ].map(({ bg, label }) => (
          <span key={label} className="compare-matrix-legend-swatch"
            style={{ background: bg, color: bg === '#7f1d1d' || bg === '#ef4444' ? '#fff' : '#1f2937', padding: '2px 6px', borderRadius: 3, fontSize: 10, marginLeft: 4 }}>
            {label}
          </span>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip.show && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y,
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          padding: '6px 10px',
          borderRadius: 4,
          fontSize: 11,
          pointerEvents: 'none',
          zIndex: 9999,
          whiteSpace: 'nowrap',
        }}>
          {tooltip.content}
        </div>
      )}
    </div>
  );
}

// ─── Overwintering survival paired bar chart ─────────────────────────────────

const SURV_MARGIN = { top: 24, right: 20, bottom: 64, left: 56 };

function SurvivalChart({ data, width = 860 }) {
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: '' });

  if (!data || !data.hives || data.hives.length === 0) return null;

  // Sort hives by effect magnitude (largest harm first)
  const hives = [...data.hives].sort((a, b) => b.effect - a.effect);
  const threshold = data.threshold || 4000;

  const chartHeight = 280;
  const innerW = width - SURV_MARGIN.left - SURV_MARGIN.right;
  const innerH = chartHeight - SURV_MARGIN.top - SURV_MARGIN.bottom;

  // Spacing: allocate space per hive
  const spacingPerHive = innerW / hives.length;
  const barWidth = Math.min(40, spacingPerHive * 0.35);
  const gapBetweenBars = 8;

  // Y scale: 0 at bottom, 1 at top
  const yScale = (v) => SURV_MARGIN.top + (1 - v) * innerH;
  
  // X position for each hive's group center
  const xCenter = (i) => SURV_MARGIN.left + i * spacingPerHive + spacingPerHive / 2;

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <div className="compare-matrix-wrap" style={{ marginTop: 24 }}>
      <div className="compare-section-title">
        Overwintering Survival Probability
        <span style={{ fontWeight: 'normal', fontSize: 11, marginLeft: 12, color: '#6b7280' }}>
          (colony threshold: {threshold.toLocaleString()} adult bees on last day)
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
        Green = untreated, Orange = treated. Effect shown above pairs (negative = treatment reduces survival).
      </div>
      <svg width={width} height={chartHeight}>
        {/* Background */}
        <rect x={SURV_MARGIN.left} y={SURV_MARGIN.top} width={innerW} height={innerH}
          fill="#fafafa" stroke="#e5e7eb" />

        {/* Y grid lines + labels */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={SURV_MARGIN.left} x2={SURV_MARGIN.left + innerW}
              y1={yScale(v)} y2={yScale(v)} stroke="#e5e7eb"
              strokeDasharray={v === 0.5 ? '4 3' : '2 4'} />
            <text x={SURV_MARGIN.left - 8} y={yScale(v)} textAnchor="end"
              dominantBaseline="middle" fontSize="10" fill="#555">
              {`${(v * 100).toFixed(0)}%`}
            </text>
          </g>
        ))}

        {/* Y axis label */}
        <text
          transform={`translate(14, ${SURV_MARGIN.top + innerH / 2}) rotate(-90)`}
          textAnchor="middle" fontSize="10" fill="#374151">
          P(survival)
        </text>

        {/* Bars per hive */}
        {hives.map((hive, i) => {
          const center = xCenter(i);
          const baselineX = center - barWidth - gapBetweenBars / 2;
          const treatedX = center + gapBetweenBars / 2;
          
          const baselineY = yScale(hive.baseline_survival);
          const baselineHeight = hive.baseline_survival * innerH;
          
          const treatedY = yScale(hive.scenario_survival);
          const treatedHeight = hive.scenario_survival * innerH;
          
          const effectPct = (Math.abs(hive.effect) * 100).toFixed(1);
          const effectColor = hive.effect > 0.01 ? '#dc2626' : hive.effect < -0.01 ? '#059669' : '#6b7280';

          return (
            <g key={i}>
              {/* Untreated bar (green) */}
              <rect
                x={baselineX} y={baselineY} width={barWidth} height={baselineHeight}
                fill="#22c55e" stroke="#16a34a" strokeWidth="1" rx="2"
                onMouseEnter={(e) => setTooltip({
                  show: true, x: e.clientX + 12, y: e.clientY - 10,
                  content: `${hive.hive_group_id} — Untreated\nP(survival) = ${(hive.baseline_survival * 100).toFixed(1)}%\n(n=${hive.n_replicates_baseline})`,
                })}
                onMouseLeave={() => setTooltip({ show: false, x: 0, y: 0, content: '' })}
              />
              {/* Treated bar (orange) */}
              <rect
                x={treatedX} y={treatedY} width={barWidth} height={treatedHeight}
                fill="#f97316" stroke="#ea580c" strokeWidth="1" rx="2"
                onMouseEnter={(e) => setTooltip({
                  show: true, x: e.clientX + 12, y: e.clientY - 10,
                  content: `${hive.hive_group_id} — Treated\nP(survival) = ${(hive.scenario_survival * 100).toFixed(1)}%\n(n=${hive.n_replicates_scenario})`,
                })}
                onMouseLeave={() => setTooltip({ show: false, x: 0, y: 0, content: '' })}
              />
              {/* Effect label above */}
              <text x={center} y={SURV_MARGIN.top - 8} textAnchor="middle"
                fontSize="9" fontWeight="bold" fill={effectColor}>
                {hive.effect > 0 ? `−${effectPct}%` : hive.effect < 0 ? `+${effectPct}%` : '0%'}
              </text>
              {/* Hive label below */}
              <text x={center} y={SURV_MARGIN.top + innerH + 14} textAnchor="middle"
                fontSize="9" fill="#374151">
                {hive.hive_group_id}
              </text>
            </g>
          );
        })}

        {/* 50% reference line */}
        <line x1={SURV_MARGIN.left} x2={SURV_MARGIN.left + innerW}
          y1={yScale(0.5)} y2={yScale(0.5)} stroke="#9ca3af" strokeWidth="1"
          strokeDasharray="4 3" />
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#374151', marginTop: 4 }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#22c55e', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />Untreated (baseline)</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#f97316', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />Treated (scenario)</span>
        <span style={{ color: '#6b7280' }}>Effect = baseline − treated (positive = treatment reduces survival)</span>
      </div>

      {/* Tooltip */}
      {tooltip.show && (
        <div style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y,
          background: 'rgba(0,0,0,0.85)', color: '#fff',
          padding: '6px 10px', borderRadius: 4, fontSize: 11,
          pointerEvents: 'none', zIndex: 9999, whiteSpace: 'pre-line',
        }}>
          {tooltip.content}
        </div>
      )}
    </div>
  );
}

// ─── Main compare component ─────────────────────────────────────────────────

/**
 * Build paired baseline/scenario IDs for the matrix.
 *
 * Priority:
 *  1. If viewRunIds chip selection contains ≥1 run, restrict to those.
 *  2. Otherwise, use ALL available runs.
 *
 * Within the chosen set, pair runs sharing the same hive_group_id where
 * one is untreated (baseline) and one is treated (scenario).
 * A run that has no matching counterpart is silently skipped.
 */
/**
 * Pair runs from the View-chip selection only.
 * Runs sharing hive_group_id are paired: untreated=baseline, treated=scenario.
 */
function buildPairSelection(availableRuns, viewRunIds) {
  if (!viewRunIds || viewRunIds.length === 0) return { baselineIds: [], scenarioIds: [] };
  const selected = availableRuns.filter((r) => viewRunIds.includes(r.id));
  const groups = new Map();
  selected.forEach((run) => {
    // Group by hive location, normalizing away treatment suffixes like "_treated" or "_untreated"
    let hive = run.hive_group_id || run.sim_id;
    hive = hive.replace(/_(?:treated|untreated)$/, '');
    const mc = run.outer_mc_id !== undefined && run.outer_mc_id !== null ? run.outer_mc_id : 'default';
    const key = `${hive}::${mc}`;
    if (!groups.has(key)) groups.set(key, { untreated: null, treated: null });
    const entry = groups.get(key);
    if (run.treatment_on) { if (!entry.treated)   entry.treated   = run.id; }
    else                  { if (!entry.untreated) entry.untreated = run.id; }
  });
  const baselineIds = [], scenarioIds = [];
  groups.forEach((v) => {
    if (v.untreated != null && v.treated != null) {
      baselineIds.push(v.untreated);
      scenarioIds.push(v.treated);
    }
  });
  return { baselineIds, scenarioIds };
}

const CompareChart = () => {
  const metric    = useSelector((s) => s.runs.selectedMetric);
  const threshold = useSelector((s) => s.runs.threshold);
  const availableRuns = useSelector((s) => s.runs.availableRuns);
  const viewRunIds    = useSelector((s) => s.runs.viewRunIds);

  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [spatialScope, setSpatialScope] = useState('pair');

  const { baselineIds, scenarioIds } = useMemo(
    () => buildPairSelection(availableRuns, viewRunIds),
    [availableRuns, viewRunIds],
  );

  // Fetch percentile matrix whenever the chip selection or settings change.
  useEffect(() => {
    if (baselineIds.length === 0 || !metric) {
      setMatrixData(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      baseline_ids: baselineIds.join(','),
      scenario_ids: scenarioIds.join(','),
      metric,
      threshold: String(threshold),
      mode: 'decline',
      spatial_scope: spatialScope,
    });
    fetch(buildApiUrl(`/api/compare/percentiles?${params}`), { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setMatrixData)
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselineIds.join(','), scenarioIds.join(','), metric, threshold, spatialScope]);

  // ── No chips selected ────────────────────────────────────────────────────
  if (!viewRunIds || viewRunIds.length === 0) {
    return (
      <div className="compare-chart-container compare-chart-empty">
        <div style={{ marginBottom: 8 }}>Select runs using the <strong>View</strong> chips in the header.</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          Select at least one untreated and one treated run that share the same hive
          location. The matrix will appear automatically.
        </div>
      </div>
    );
  }

  // ── Chips selected but no complete pair ──────────────────────────────────
  if (baselineIds.length === 0) {
    return (
      <div className="compare-chart-container compare-chart-empty">
        No complete treated/untreated pairs found in the current selection.
        Make sure you select both a treated and an untreated run sharing the same hive group.
      </div>
    );
  }

  // ── Matrix ───────────────────────────────────────────────────────────────
  const simStart = availableRuns.find((r) => r.id === baselineIds[0])?.sim_start || null;

  return (
    <div className="compare-chart-container">
      <div className="compare-summary">
        {baselineIds.length} paired location{baselineIds.length === 1 ? '' : 's'}
        <span className="compare-summary-hint">
          &nbsp;·&nbsp;{viewRunIds.length} chips selected
        </span>
        <label className="compare-scope-control">
          percentile scope:
          <select value={spatialScope} onChange={(e) => setSpatialScope(e.target.value)}>
            <option value="pair">pair (each MC pair)</option>
            <option value="hive_mean">hive mean (aggregate MC first)</option>
          </select>
        </label>
        <span className="legend-swatch dashed-red" />
        decline threshold {(threshold * 100).toFixed(0)}%
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>
          metric:&nbsp;<code>{metric?.split('+').slice(0, 2).join('+').trim()}{metric?.includes('+') ? '…' : ''}</code>
        </span>
      </div>

      {loading && <div className="compare-status">Loading…</div>}
      {error   && <div className="compare-status compare-error">Error: {error}</div>}

      {matrixData && (
        <>
          <PercentileMatrix
            data={matrixData}
            threshold={threshold}
            simStart={simStart}
          />
          <div className="compare-meta">
            {(matrixData.n_spatial_units ?? matrixData.temporal?.per_hive?.length) || 0} spatial unit{((matrixData.n_spatial_units ?? matrixData.temporal?.per_hive?.length) || 0) === 1 ? '' : 's'}
            &nbsp;·&nbsp;from {matrixData.n_selected_pairs ?? baselineIds.length} selected pair{(matrixData.n_selected_pairs ?? baselineIds.length) === 1 ? '' : 's'}
            &nbsp;·&nbsp;metric: <code>{metric}</code>
            &nbsp;·&nbsp;scope: <code>{spatialScope}</code>
          </div>
        </>
      )}
    </div>
  );
};

export default CompareChart;
