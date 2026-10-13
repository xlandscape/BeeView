/**
 * Utilities for grouping runs by batch and MC for hierarchical display.
 * Grouping: batch_sim_id → outer_mc_id → treatment (untreated/treated)
 */

/**
 * Treatment variant of a run: 'untreated', or the GAP preset id of a treated run
 * ('treated' for runs imported without a <GAP> element). Several treated variants
 * per hive (e.g. default and thiacloprid) are told apart by this key.
 */
export function treatmentKey(run) {
  if (!run || !run.treatment_on) return 'untreated';
  return run.gap || 'treated';
}

/** Human-readable name of a treatment key for chips and selectors. */
export function treatmentLabel(key) {
  if (key === 'untreated') return 'untreated';
  if (key === 'treated' || key === 'default') return 'treated';
  return key.replace(/_/g, ' ');
}

/**
 * Display name of a treated run's variant. Batch runs are labelled
 * "<hive>_<treatment>" (e.g. hive_3614_Dimethoate), so the suffix after the
 * hive group id names the variant; otherwise fall back to the GAP preset id.
 */
export function variantLabel(run) {
  if (!run) return 'treated';
  const hive = run.hive_group_id || run.batch_sim_id || '';
  const label = run.label || run.sim_id || '';
  if (hive && label.startsWith(`${hive}_`)) {
    const suffix = label.slice(hive.length + 1).replace(/_MC\d+$/, '');
    if (suffix && suffix !== 'treated' && suffix !== 'untreated') return suffix.replace(/_/g, ' ');
  }
  return treatmentLabel(treatmentKey(run));
}

/**
 * Group runs by hive / batch for hierarchical display.
 * Each group lists its untreated runs, all treated runs, and the treated runs
 * split by treatment variant (`treatments`, default GAP first).
 */
export function groupRunsByMC(runs) {
  if (!runs || runs.length === 0) return [];

  const groupMap = new Map();

  runs.forEach((run) => {
    const batch = run.hive_group_id || run.batch_sim_id || 'legacy';
    // All outer-MC runs for the same batch are shown as one chip
    const key = batch;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        batch_sim_id: batch,
        label: batch,
        untreated: [],
        treated: [],
        treatments: [],
        all: [],
      });
    }

    const group = groupMap.get(key);
    group.all.push(run);
    if (run.treatment_on) {
      group.treated.push(run);
      const variantKey = treatmentKey(run);
      let variant = group.treatments.find((t) => t.key === variantKey);
      if (!variant) {
        variant = { key: variantKey, label: variantLabel(run), runs: [] };
        group.treatments.push(variant);
      }
      variant.runs.push(run);
    } else {
      group.untreated.push(run);
    }
  });

  const variantOrder = (t) => (t.key === 'treated' || t.key === 'default' ? 0 : 1);
  groupMap.forEach((group) => {
    group.treatments.sort((a, b) => variantOrder(a) - variantOrder(b) || a.key.localeCompare(b.key));
  });

  return Array.from(groupMap.values()).sort((a, b) => {
    return a.batch_sim_id.localeCompare(b.batch_sim_id);
  });
}

/**
 * Get the MC-aware label for a single run.
 * Format: "label [MC0]" or just "label" if legacy (no outer_mc_id).
 */
export function getMCLabel(run) {
  const base = run.label || run.sim_id;
  if (run.outer_mc_id !== undefined && run.outer_mc_id !== null) {
    return `${base} [MC${run.outer_mc_id}]`;
  }
  return base;
}

/**
 * Check if two runs belong to the same MC group.
 * Used to enforce that comparisons stay within the same MC.
 */
export function isSameMC(run1, run2) {
  if (!run1 || !run2) return false;

  const batch1 = run1.hive_group_id || run1.batch_sim_id || 'legacy';
  const batch2 = run2.hive_group_id || run2.batch_sim_id || 'legacy';
  const mc1 = run1.outer_mc_id !== undefined ? run1.outer_mc_id : 'default';
  const mc2 = run2.outer_mc_id !== undefined ? run2.outer_mc_id : 'default';

  return batch1 === batch2 && mc1 === mc2;
}

/**
 * Get all runs for a specific MC group.
 */
export function getRunsForMC(allRuns, batch, outerMcId) {
  return allRuns.filter((r) => {
    const b = r.hive_group_id || r.batch_sim_id || 'legacy';
    const mc = r.outer_mc_id !== undefined ? r.outer_mc_id : 'default';
    return b === batch && mc === outerMcId;
  });
}
