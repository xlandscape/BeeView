import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAvailableRuns,
  setBaselineRunId,
  setScenarioRunId,
  setSelectedMetric,
  setThreshold,
} from '../../store/slices/runsSlice';
import { getMCLabel, isSameMC } from '../../utils/runGrouping';
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
  const mcLabel = getMCLabel(run);
  return (
    <option value={run.id}>
      {mcLabel} · {tag} · {run.n_replicates} reps
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

  // Find the baseline run if selected
  const baselineRun = useMemo(
    () => availableRuns.find((r) => r.id === baselineRunId),
    [availableRuns, baselineRunId]
  );

  // Filter runs by MC and treatment status.
  // When baseline is selected, only show treated runs from the same MC.
  const { untreatedRuns, treatedRuns } = useMemo(() => {
    const allUntreated = availableRuns.filter((r) => !r.treatment_on);
    let allTreated = availableRuns.filter((r) => r.treatment_on);

    // If baseline is selected, filter treated runs to the same MC.
    if (baselineRun) {
      allTreated = allTreated.filter((t) => isSameMC(baselineRun, t));
    }

    return {
      untreatedRuns: allUntreated,
      treatedRuns: allTreated,
    };
  }, [availableRuns, baselineRun]);

  const onChangeBaseline = (e) => {
    const v = e.target.value;
    dispatch(setBaselineRunId(v ? Number(v) : null));
    // Clear scenario when baseline changes, to avoid MC mismatch.
    dispatch(setScenarioRunId(null));
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
      {baselineRun && (baselineRun.outer_mc_id !== undefined || baselineRun.batch_sim_id) && (
        <div className="mc-note">
          MC: {baselineRun.batch_sim_id || baselineRun.hive_group_id}
          {baselineRun.outer_mc_id !== undefined && ` (MC${baselineRun.outer_mc_id})`}
        </div>
      )}
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
        <select value={scenarioRunId ?? ''} onChange={onChangeScenario} disabled={!baselineRunId}>
          <option value="">— select —</option>
          {treatedRuns.length === 0 && (
            <option disabled>
              {baselineRunId ? '(no treated runs in this MC)' : '(select baseline first)'}
            </option>
          )}
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
