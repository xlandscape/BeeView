/**
 * Utilities for grouping runs by batch and MC for hierarchical display.
 * Grouping: batch_sim_id → outer_mc_id → treatment (untreated/treated)
 */

/**
 * Group runs by (batch_sim_id, outer_mc_id) for hierarchical display.
 * Returns an array of groups, each with metadata and contained runs.
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
        all: [],
      });
    }

    const group = groupMap.get(key);
    group.all.push(run);
    if (run.treatment_on) {
      group.treated.push(run);
    } else {
      group.untreated.push(run);
    }
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
