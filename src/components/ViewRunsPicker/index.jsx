import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAvailableRuns,
  setViewRunIds,
  RUN_COLOR_PALETTE,
} from '../../store/slices/runsSlice';
import { groupRunsByMC } from '../../utils/runGrouping';
import './ViewRunsPicker.css';

const ViewRunsPicker = () => {
  const dispatch = useDispatch();
  const status = useSelector((s) => s.runs.status);
  const error = useSelector((s) => s.runs.error);
  const availableRuns = useSelector((s) => s.runs.availableRuns);
  const viewRunIds = useSelector((s) => s.runs.viewRunIds);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchAvailableRuns());
    }
  }, [status, dispatch]);

  const groups = useMemo(() => groupRunsByMC(availableRuns || []), [availableRuns]);

  if (status === 'loading') {
    return <div className="view-runs-picker">Loading runs…</div>;
  }
  if (status === 'failed') {
    return <div className="view-runs-picker">Runs unavailable: {error}</div>;
  }

  if (!availableRuns || availableRuns.length === 0) return null;

  const onClear = () => dispatch(setViewRunIds([]));

  return (
    <div className="view-runs-picker">
      <span className="view-runs-label">View:</span>
      <div className="view-runs-groups">
        {groups.map((group, colorIdx) => {
          // One chip per treatment variant; the variant name is shown only when a hive
          // has several treated variants or a non-default GAP (e.g. thiacloprid).
          const showVariantName = group.treatments.length > 1
            || group.treatments.some((t) => t.label !== 'treated');
          const variants = [
            { tag: 'U', key: 'untreated', runs: group.untreated, treatmentLabel: 'untreated', suffix: '' },
            ...group.treatments.map((t) => ({
              tag: 'T',
              key: t.key,
              runs: t.runs,
              treatmentLabel: t.label,
              suffix: showVariantName ? t.label : '',
            })),
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
                key={`${group.batch_sim_id}-${variant.key}`}
                type="button"
                className={`view-run-chip ${isOn ? 'on' : ''}`}
                style={isOn ? { borderColor: color, color } : undefined}
                onClick={onToggleVariant}
                title={`${group.batch_sim_id} · ${variant.treatmentLabel} · ${variant.runs.length} MC run(s) · ${totalReps} total reps`}
              >
                <span className="chip-tag">{variant.tag}</span>
                {group.label}
                {variant.suffix && <span className="chip-variant"> · {variant.suffix}</span>}
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
