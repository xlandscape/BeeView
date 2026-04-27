import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  toggleViewRunId,
  setViewRunIds,
  RUN_COLOR_PALETTE,
} from '../../store/slices/runsSlice';
import './ViewRunsPicker.css';

const ViewRunsPicker = () => {
  const dispatch = useDispatch();
  const availableRuns = useSelector((s) => s.runs.availableRuns);
  const viewRunIds = useSelector((s) => s.runs.viewRunIds);

  if (!availableRuns || availableRuns.length === 0) return null;

  const onToggle = (id) => dispatch(toggleViewRunId(id));
  const onClear = () => dispatch(setViewRunIds([]));

  return (
    <div className="view-runs-picker">
      <span className="view-runs-label">View:</span>
      {availableRuns.map((run) => {
        const isOn = viewRunIds.includes(run.id);
        const idx = viewRunIds.indexOf(run.id);
        const color = isOn ? RUN_COLOR_PALETTE[idx % RUN_COLOR_PALETTE.length] : null;
        const tag = run.treatment_on ? 'T' : 'U';
        return (
          <button
            key={run.id}
            type="button"
            className={`view-run-chip ${isOn ? 'on' : ''}`}
            style={isOn ? { borderColor: color, color } : undefined}
            onClick={() => onToggle(run.id)}
            title={`${run.label || run.sim_id} · ${run.treatment_on ? 'treated' : 'untreated'} · ${run.n_replicates} reps`}
          >
            <span className="chip-tag">{tag}</span>
            {run.label || run.sim_id}
          </button>
        );
      })}
      {viewRunIds.length > 0 && (
        <button type="button" className="view-runs-clear" onClick={onClear}>
          clear
        </button>
      )}
    </div>
  );
};

export default ViewRunsPicker;
