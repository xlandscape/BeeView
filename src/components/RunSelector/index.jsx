import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAvailableRuns,
  setBaselineRunId,
  setScenarioRunId,
  setSelectedMetric,
  setThreshold,
} from '../../store/slices/runsSlice';
import './RunSelector.css';

// Metric display names for the dropdown. The keys must match the bee_population_replicate
// metric_name strings exactly (canonical, single-spaced) — see import_run.py METRIC_COLUMNS.
const METRIC_OPTIONS = [
  {
    value:
      'TotalIHbees + TotalForagers + TotalDroneEggs + TotalEggs + TotalDroneLarvae + TotalLarvae + TotalDronePupae + TotalPupae',
    label: 'Total colony',
  },
  { value: 'TotalIHbees + TotalForagers', label: 'Adults' },
  { value: 'TotalDroneEggs + TotalEggs', label: 'Eggs' },
  { value: 'TotalDroneLarvae + TotalLarvae', label: 'Larvae' },
  { value: 'TotalDronePupae + TotalPupae', label: 'Pupae' },
  { value: 'HoneyEnergyStore', label: 'Honey energy' },
  { value: 'PollenStore_g', label: 'Pollen store' },
];

function RunOption({ run }) {
  const tag = run.treatment_on ? 'treated' : 'untreated';
  const label = run.label || run.sim_id;
  return (
    <option value={run.id}>
      {label} · {tag} · {run.n_replicates} reps
    </option>
  );
}

const RunSelector = () => {
  const dispatch = useDispatch();
  const { availableRuns, baselineRunId, scenarioRunId, selectedMetric, threshold, status, error } =
    useSelector((state) => state.runs);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchAvailableRuns());
    }
  }, [status, dispatch]);

  const { untreatedRuns, treatedRuns } = useMemo(() => {
    return {
      untreatedRuns: availableRuns.filter((r) => !r.treatment_on),
      treatedRuns: availableRuns.filter((r) => r.treatment_on),
    };
  }, [availableRuns]);

  const onChangeBaseline = (e) => {
    const v = e.target.value;
    dispatch(setBaselineRunId(v ? Number(v) : null));
  };
  const onChangeScenario = (e) => {
    const v = e.target.value;
    dispatch(setScenarioRunId(v ? Number(v) : null));
  };
  const onChangeMetric = (e) => dispatch(setSelectedMetric(e.target.value));
  const onChangeThreshold = (e) => {
    const v = parseFloat(e.target.value);
    if (!Number.isNaN(v)) dispatch(setThreshold(v));
  };

  if (status === 'loading') {
    return <div className="run-selector run-selector-loading">Loading runs…</div>;
  }
  if (status === 'failed') {
    return <div className="run-selector run-selector-error">Runs unavailable: {error}</div>;
  }
  if (availableRuns.length === 0) {
    return (
      <div className="run-selector run-selector-empty">
        No runs imported. Run <code>python import_run.py &lt;run-folder&gt;</code> on the server.
      </div>
    );
  }

  return (
    <div className="run-selector">
      <label>
        Baseline:
        <select value={baselineRunId ?? ''} onChange={onChangeBaseline}>
          <option value="">— select —</option>
          {untreatedRuns.length === 0 && (
            <option disabled>(no untreated runs)</option>
          )}
          {untreatedRuns.map((r) => (
            <RunOption key={r.id} run={r} />
          ))}
        </select>
      </label>
      <label>
        Scenario:
        <select value={scenarioRunId ?? ''} onChange={onChangeScenario}>
          <option value="">— select —</option>
          {treatedRuns.length === 0 && <option disabled>(no treated runs)</option>}
          {treatedRuns.map((r) => (
            <RunOption key={r.id} run={r} />
          ))}
        </select>
      </label>
      <label>
        Metric:
        <select value={selectedMetric} onChange={onChangeMetric}>
          {METRIC_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Threshold:
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={threshold}
          onChange={onChangeThreshold}
          style={{ width: 60 }}
        />
      </label>
    </div>
  );
};

export default RunSelector;
