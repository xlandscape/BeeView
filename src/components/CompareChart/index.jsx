import React, { useEffect, useState } from 'react';
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
        label={`fraction of pairs |Δ|>${(threshold * 100).toFixed(0)}%`}
        format={(v) => `${(v * 100).toFixed(0)}%`}
      />
      <XAxis xDomain={xDomain} xScale={xScale} height={EXCEEDANCE_HEIGHT} />
    </svg>
  );
}

const CompareChart = () => {
  const baselineRunId = useSelector((s) => s.runs.baselineRunId);
  const scenarioRunId = useSelector((s) => s.runs.scenarioRunId);
  const metric = useSelector((s) => s.runs.selectedMetric);
  const threshold = useSelector((s) => s.runs.threshold);
  const availableRuns = useSelector((s) => s.runs.availableRuns);

  const [relative, setRelative] = useState(null);
  const [exceedance, setExceedance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const onResize = () => {
      const el = document.querySelector('.compare-chart-container');
      if (el) setWidth(Math.max(600, el.clientWidth - 32));
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!baselineRunId || !scenarioRunId || !metric) {
      setRelative(null);
      setExceedance(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      baseline_id: String(baselineRunId),
      scenario_id: String(scenarioRunId),
      metric,
    });
    const exceedanceParams = new URLSearchParams(params);
    exceedanceParams.set('threshold', String(threshold));

    Promise.all([
      fetch(buildApiUrl(`/api/compare/relative?${params}`), { signal: controller.signal }).then(
        (r) => {
          if (!r.ok) throw new Error(`relative HTTP ${r.status}`);
          return r.json();
        },
      ),
      fetch(buildApiUrl(`/api/compare/exceedance?${exceedanceParams}`), {
        signal: controller.signal,
      }).then((r) => {
        if (!r.ok) throw new Error(`exceedance HTTP ${r.status}`);
        return r.json();
      }),
    ])
      .then(([rel, exc]) => {
        setRelative(rel);
        setExceedance(exc);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [baselineRunId, scenarioRunId, metric, threshold]);

  const baselineRun = availableRuns.find((r) => r.id === baselineRunId);
  const scenarioRun = availableRuns.find((r) => r.id === scenarioRunId);

  if (!baselineRunId || !scenarioRunId) {
    return (
      <div className="compare-chart-container compare-chart-empty">
        Pick a baseline (untreated) and scenario (treated) run from the header to compare.
      </div>
    );
  }

  return (
    <div className="compare-chart-container">
      <div className="compare-summary">
        <span className="legend-swatch" style={{ background: '#1d4ed8' }} />
        Mean (scenario − baseline) / baseline · {baselineRun?.label || baselineRunId} →{' '}
        {scenarioRun?.label || scenarioRunId}
        <span className="legend-swatch band" />
        p10 – p90 across replicate pairs
        <span className="legend-swatch dashed-red" />
        ±{(threshold * 100).toFixed(0)}% threshold
      </div>
      {loading && <div className="compare-status">Loading…</div>}
      {error && <div className="compare-status compare-error">Error: {error}</div>}
      {relative && (
        <RelativePanel
          days={relative.days}
          mean={relative.mean}
          p10={relative.p10}
          p50={relative.p50}
          p90={relative.p90}
          width={width}
          threshold={threshold}
        />
      )}
      {exceedance && (
        <ExceedancePanel
          days={exceedance.days}
          fractions={exceedance.exceedance_fraction}
          width={width}
          threshold={threshold}
        />
      )}
      {relative && (
        <div className="compare-meta">
          {relative.n_pairs} replicate pair{relative.n_pairs === 1 ? '' : 's'} · metric:{' '}
          <code>{metric}</code>
        </div>
      )}
    </div>
  );
};

export default CompareChart;
