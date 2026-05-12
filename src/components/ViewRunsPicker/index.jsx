import React, { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setViewRunIds,
  RUN_COLOR_PALETTE,
} from '../../store/slices/runsSlice';
import { groupRunsByMC } from '../../utils/runGrouping';
import './ViewRunsPicker.css';

const ViewRunsPicker = () => {
  const dispatch = useDispatch();
  const availableRuns = useSelector((s) => s.runs.availableRuns);
  const viewRunIds = useSelector((s) => s.runs.viewRunIds);

  const groups = useMemo(() => groupRunsByMC(availableRuns || []), [availableRuns]);

  if (!availableRuns || availableRuns.length === 0) return null;

  const onClear = () => dispatch(setViewRunIds([]));

  return (
    <div className="view-runs-picker">
      <span className="view-runs-label">View:</span>
      <div className="view-runs-groups">
        {groups.map((group, colorIdx) => {
          const variants = [
            { tag: 'U', runs: group.untreated, treatmentLabel: 'untreated' },
            { tag: 'T', runs: group.treated, treatmentLabel: 'treated' },
          ].filter((v) => v.runs.length > 0);

          return variants.map((variant, variantIdx) => {
            const runIds = variant.runs.map((r) => r.id);
            const isOn = runIds.length > 0 && runIds.every((id) => viewRunIds.includes(id));
            const color = isOn
              ? RUN_COLOR_PALETTE[(colorIdx + variantIdx) % RUN_COLOR_PALETTE.length]
              : null;
            const totalReps = variant.runs.reduce((s, r) => s + (r.n_replicates || 1), 0);
            const onToggleVariant = () => {
              if (isOn) {
                dispatch(setViewRunIds(viewRunIds.filter((id) => !runIds.includes(id))));
              } else {
                dispatch(setViewRunIds([...new Set([...viewRunIds, ...runIds])]));
              }
            };

            return (
              <button
                key={`${group.batch_sim_id}-${variant.tag}`}
                type="button"
                className={`view-run-chip ${isOn ? 'on' : ''}`}
                style={isOn ? { borderColor: color, color } : undefined}
                onClick={onToggleVariant}
                title={`${group.batch_sim_id} · ${variant.treatmentLabel} · ${variant.runs.length} MC run(s) · ${totalReps} total reps`}
              >
                <span className="chip-tag">{variant.tag}</span>
                {group.label}
              </button>
            );
          });
        })}
      </div>
      {viewRunIds.length > 0 && (
        <button type="button" className="view-runs-clear" onClick={onClear}>
          clear
        </button>
      )}
    </div>
  );
};

export default ViewRunsPicker;
