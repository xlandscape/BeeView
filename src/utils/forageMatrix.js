/**
 * Client-side nectar/pollen matrices.
 *
 * The server exposes the whole nectar and pollen tables as float32 matrices
 * (features x days). They compress to a few hundred KB, so we download them
 * once and answer every "value on day N", "max over the year" and
 * "average of the selected features" question locally instead of hitting
 * the API on each slider step or selection change.
 */

import { buildApiUrl } from '../config/api';

const KINDS = ['nectar', 'pollen'];

let matrixPromise = null;
let loadedMatrix = null;

async function fetchIndex() {
  const response = await fetch(buildApiUrl('/api/forage/index'));
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching forage index`);
  return response.json();
}

async function fetchMatrix(kind) {
  const response = await fetch(buildApiUrl(`/api/forage/${kind}.f32`));
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${kind} matrix`);
  const buffer = await response.arrayBuffer();
  return new Float32Array(buffer);
}

class ForageMatrix {
  constructor(index, matrices) {
    this.featureIds = Int32Array.from(index.feature_ids);
    this.days = index.days;
    this.rows = this.featureIds.length;
    this.rowByFeatureId = new Map();
    this.featureIds.forEach((id, row) => this.rowByFeatureId.set(id, row));
    this.matrices = matrices; // { nectar: Float32Array, pollen: Float32Array }
    this._dayCache = { nectar: new Map(), pollen: new Map() };
    this._maxCache = {};
    for (const kind of KINDS) {
      const m = matrices[kind];
      if (m.length !== this.rows * this.days) {
        throw new Error(`${kind} matrix has ${m.length} values, expected ${this.rows * this.days}`);
      }
    }
  }

  value(kind, featureId, day) {
    const row = this.rowByFeatureId.get(featureId);
    if (row === undefined || day < 1 || day > this.days) return 0;
    return this.matrices[kind][row * this.days + (day - 1)];
  }

  /** { [featureId]: value } for one day (memoised; the map accessors index by feature id). */
  dayValues(kind, day) {
    const d = Math.min(Math.max(1, Number(day) || 1), this.days);
    const cache = this._dayCache[kind];
    if (cache.has(d)) return cache.get(d);
    const m = this.matrices[kind];
    const out = {};
    const offset = d - 1;
    for (let row = 0; row < this.rows; row++) {
      out[this.featureIds[row]] = m[row * this.days + offset];
    }
    if (cache.size > 32) cache.delete(cache.keys().next().value);
    cache.set(d, out);
    return out;
  }

  /** { [featureId]: max over the year } */
  maxValues(kind) {
    if (this._maxCache[kind]) return this._maxCache[kind];
    const m = this.matrices[kind];
    const out = {};
    for (let row = 0; row < this.rows; row++) {
      let best = 0;
      const base = row * this.days;
      for (let d = 0; d < this.days; d++) {
        const v = m[base + d];
        if (v > best) best = v;
      }
      out[this.featureIds[row]] = best;
    }
    this._maxCache[kind] = out;
    return out;
  }

  /**
   * Daily averages across the given feature ids (all features when empty),
   * in the same shape as /api/timeseries/averages: [{day, nectar_avg, pollen_avg}].
   */
  averages(featureIds = []) {
    let rows = null;
    if (featureIds && featureIds.length > 0) {
      rows = [];
      for (const id of featureIds) {
        const row = this.rowByFeatureId.get(Number(id));
        if (row !== undefined) rows.push(row);
      }
    }
    const count = rows ? rows.length : this.rows;
    const sums = { nectar: new Float64Array(this.days), pollen: new Float64Array(this.days) };
    if (count > 0) {
      for (const kind of KINDS) {
        const m = this.matrices[kind];
        const acc = sums[kind];
        const addRow = (row) => {
          const base = row * this.days;
          for (let d = 0; d < this.days; d++) acc[d] += m[base + d];
        };
        if (rows) rows.forEach(addRow);
        else for (let row = 0; row < this.rows; row++) addRow(row);
      }
    }
    const out = new Array(Math.max(this.days, 365));
    for (let d = 0; d < out.length; d++) {
      out[d] = {
        day: d + 1,
        nectar_avg: d < this.days && count > 0 ? sums.nectar[d] / count : 0,
        pollen_avg: d < this.days && count > 0 ? sums.pollen[d] / count : 0,
      };
    }
    return out;
  }
}

/** Resolve to the shared ForageMatrix (downloaded on first call, then cached). */
export function loadForageMatrix() {
  if (!matrixPromise) {
    matrixPromise = (async () => {
      const [index, nectar, pollen] = await Promise.all([fetchIndex(), fetchMatrix('nectar'), fetchMatrix('pollen')]);
      loadedMatrix = new ForageMatrix(index, { nectar, pollen });
      return loadedMatrix;
    })().catch((err) => {
      matrixPromise = null; // allow a retry on the next call
      throw err;
    });
  }
  return matrixPromise;
}

/** Synchronous access once loaded, or null. */
export function getLoadedForageMatrix() {
  return loadedMatrix;
}
