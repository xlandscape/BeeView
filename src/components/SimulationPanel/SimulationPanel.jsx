import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchScenarios,
  fetchScenarioBounds,
  fetchGaps,
  saveGapPreset,
  submitSimulation,
  fetchJobs,
  cancelJob,
  updateForm,
  resetForm,
  setHivePlacementMode,
  closeSimulationPanel,
  setGapOverride,
  clearGapOverrides,
  setTreatmentMode,
  addTreatment,
  updateTreatment,
  removeTreatment,
  resetPresetSave,
} from '../../store/slices/simulationSlice';
import './SimulationPanel.css';

const STATUS_LABELS = {
  queued: '⏳ Queued',
  running: '🔄 Running',
  completed: '✅ Completed',
  importing: '📥 Importing',
  done: '✅ Done',
  error: '❌ Error',
  cancelled: '🚫 Cancelled',
};

function formatDuration(startedAt, finishedAt) {
  if (!startedAt) return '—';
  const end = finishedAt || Date.now() / 1000;
  const seconds = Math.round(end - startedAt);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

/**
 * Preset details with one editable value per parameter. Edited values become
 * overrides that are sent next to the GAP id (the server merges them over the
 * preset). "Save as preset" stores preset + overrides as a new catalog entry.
 */
function GapCard({ gap, parameters, overrides, onOverride, onClearOverrides, treatmentOn }) {
  const dispatch = useDispatch();
  const { presetSaveStatus, presetSaveError } = useSelector((s) => s.simulation);
  const [saveOpen, setSaveOpen] = useState(false);
  const [draft, setDraft] = useState({ id: '', label: '', substance: '', crop: '', source: '', notes: '' });
  const overrideCount = Object.keys(overrides || {}).length;

  useEffect(() => {
    if (presetSaveStatus === 'succeeded') {
      setSaveOpen(false);
      const t = setTimeout(() => dispatch(resetPresetSave()), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [presetSaveStatus, dispatch]);

  if (!gap) return null;

  const openSave = () => {
    setDraft({
      id: '',
      label: `${gap.label} (modified)`,
      substance: gap.substance || '',
      crop: gap.crop || '',
      source: `Derived from preset ${gap.id}`,
      notes: '',
    });
    setSaveOpen(true);
  };

  const submitSave = (e) => {
    e.preventDefault();
    const params = {};
    Object.entries(gap.params).forEach(([key, value]) => {
      params[key] = overrides && overrides[key] !== undefined ? Number(overrides[key]) : value;
    });
    dispatch(saveGapPreset({ ...draft, params }));
  };

  return (
    <div className={`gap-card${treatmentOn ? '' : ' gap-card-inactive'}`}>
      <div className="gap-card-meta">
        <div><strong>Substance:</strong> {gap.substance}</div>
        <div><strong>Crop:</strong> {gap.crop}</div>
        {gap.source && <div><strong>Source:</strong> {gap.source}</div>}
        {gap.notes && <div className="gap-card-notes">{gap.notes}</div>}
      </div>
      <table className="gap-card-table">
        <tbody>
          {Object.entries(gap.params).map(([key, value]) => {
            const overridden = overrides && overrides[key] !== undefined;
            return (
              <tr key={key} title={parameters[key]?.description || ''}>
                <td className="gap-card-key">{key}</td>
                <td>
                  <input
                    type="number"
                    step="any"
                    className={overridden ? 'overridden' : ''}
                    value={overridden ? overrides[key] : value}
                    onChange={(e) => onOverride(key, e.target.value === '' ? null : Number(e.target.value))}
                  />
                </td>
                <td className="gap-card-unit">{parameters[key]?.unit || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!treatmentOn && (
        <p className="sim-note">Treatment is off (Max Applications = 0); the toxicity values are still used, no application takes place.</p>
      )}
      <div className="gap-card-actions">
        {overrideCount > 0 && (
          <button type="button" onClick={onClearOverrides}>reset {overrideCount} override{overrideCount === 1 ? '' : 's'}</button>
        )}
        <button type="button" onClick={openSave}>save as preset…</button>
        {presetSaveStatus === 'succeeded' && <span className="sim-note">preset saved</span>}
      </div>
      {saveOpen && (
        <form className="gap-save-form" onSubmit={submitSave}>
          <input placeholder="id, e.g. thiacloprid_pear_FR_150" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} required pattern="[A-Za-z0-9][A-Za-z0-9_.-]{1,79}" />
          <input placeholder="label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} required />
          <input placeholder="substance" value={draft.substance} onChange={(e) => setDraft({ ...draft, substance: e.target.value })} required />
          <input placeholder="crop" value={draft.crop} onChange={(e) => setDraft({ ...draft, crop: e.target.value })} required />
          <input placeholder="source (label, Homologa use, document)" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
          <textarea placeholder="notes" rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          <div className="gap-card-actions">
            <button type="submit" disabled={presetSaveStatus === 'loading'}>{presetSaveStatus === 'loading' ? 'saving…' : 'save to gaps.json'}</button>
            <button type="button" onClick={() => setSaveOpen(false)}>cancel</button>
          </div>
          {presetSaveStatus === 'failed' && <div className="sim-msg error">{presetSaveError}</div>}
        </form>
      )}
    </div>
  );
}

function SimulationPanel() {
  const dispatch = useDispatch();
  const {
    form, scenarios, scenariosLoading, gaps, gapParameters, gapsLoading,
    submitStatus, submitError, jobs, hivePlacementMode,
  } = useSelector((state) => state.simulation);
  const [tab, setTab] = useState('form');

  useEffect(() => {
    dispatch(fetchScenarios());
    dispatch(fetchGaps());
    dispatch(fetchJobs());
  }, [dispatch]);

  // Poll jobs when on jobs tab or when there are active jobs
  useEffect(() => {
    const hasActive = jobs.some((j) => ['queued', 'running', 'importing'].includes(j.status));
    if (tab === 'jobs' || hasActive) {
      const interval = setInterval(() => dispatch(fetchJobs()), 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [dispatch, tab, jobs]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const parsed = type === 'number' ? (value === '' ? '' : Number(value)) : value;
    dispatch(updateForm({ [name]: parsed }));
  };

  const handleScenarioChange = (e) => {
    const folderName = e.target.value;
    const scenario = scenarios.find((s) => s.folder_name === folderName);
    dispatch(updateForm({ Project: scenario ? scenario.path : '' }));
    if (folderName) {
      dispatch(fetchScenarioBounds(folderName));
    }
  };

  const handleGapChange = (e) => {
    dispatch(updateForm({ GAP: e.target.value }));
    dispatch(clearGapOverrides());
  };

  const selectedScenario = scenarios.find((s) => s.path === form.Project);
  const selectedScenarioFolder = selectedScenario?.folder_name || '';
  const selectedGap = useMemo(() => gaps.find((g) => g.id === form.GAP), [gaps, form.GAP]);
  const treatmentOn = Number(form.MaxNumberApplications) > 0;
  const activeJobCount = jobs.filter((j) => ['queued', 'running', 'importing'].includes(j.status)).length;

  const handleSubmit = (e) => {
    e.preventDefault();
    const { overrides, treatmentMode, treatments, ...rest } = form;
    const params = { ...rest, ...(overrides || {}) };
    if (!params.SimID) params.SimID = `run_${Date.now().toString(36)}`;
    if (!params.BeeHaveWeatherFile) delete params.BeeHaveWeatherFile;
    if (!params.RunLabel) delete params.RunLabel;
    if (!params.HiveGroupId) delete params.HiveGroupId;
    if (treatmentMode === 'set') {
      delete params.MinNumberApplications;
      delete params.MaxNumberApplications;
      params.Treatments = treatments.map((t) => ({
        id: t.id,
        GAP: t.GAP,
        MinNumberApplications: Number(t.MinNumberApplications),
        MaxNumberApplications: Number(t.MaxNumberApplications),
      }));
    }
    dispatch(submitSimulation(params));
  };

  const setMode = (mode) => dispatch(setTreatmentMode(mode));

  return (
    <div className="simulation-panel">
      <div className="sim-panel-header">
        <h2>New Simulation</h2>
        <button className="sim-close-btn" onClick={() => dispatch(closeSimulationPanel())}>✕</button>
      </div>

      <div className="sim-panel-tabs">
        <button className={`sim-tab ${tab === 'form' ? 'active' : ''}`} onClick={() => setTab('form')}>
          Configure
        </button>
        <button className={`sim-tab ${tab === 'jobs' ? 'active' : ''}`} onClick={() => setTab('jobs')}>
          Jobs {activeJobCount > 0 && <span className="job-count">{activeJobCount}</span>}
        </button>
      </div>

      <div className="sim-panel-body">
        {tab === 'form' && (
          <form className="sim-form" onSubmit={handleSubmit}>
            {/* Scenario */}
            <div className="sim-section">
              <label>Scenario</label>
              <select value={selectedScenarioFolder} onChange={handleScenarioChange} required disabled={scenariosLoading}>
                <option value="">— Select —</option>
                {scenarios.map((s) => (
                  <option key={s.folder_name} value={s.folder_name}>
                    {s.name || s.folder_name}
                  </option>
                ))}
              </select>
              {selectedScenario && (
                <div className="sim-note">
                  {selectedScenario.sunshine_hours
                    ? `Scenario weather: ${selectedScenario.sunshine_hours.description || selectedScenario.sunshine_hours.file}`
                    : 'No scenario sunshine series; Rothamsted 2009 defaults apply.'}
                </div>
              )}
            </div>

            {/* Hive Placement */}
            <div className="sim-section">
              <label>Hive Location</label>
              <button
                type="button"
                className={`sim-btn-place ${hivePlacementMode ? 'active' : ''}`}
                onClick={() => dispatch(setHivePlacementMode(!hivePlacementMode))}
              >
                {hivePlacementMode ? '🎯 Click on map...' : '📍 Place on Map'}
              </button>
              <div className="sim-coord-row">
                <input name="BeeHaveMapCenterPointX" type="number" step="any" placeholder="X" value={form.BeeHaveMapCenterPointX} onChange={handleChange} required />
                <input name="BeeHaveMapCenterPointY" type="number" step="any" placeholder="Y" value={form.BeeHaveMapCenterPointY} onChange={handleChange} required />
              </div>
            </div>

            {/* Simulation ID */}
            <div className="sim-section">
              <label>Simulation ID {form.treatmentMode === 'set' && <span className="sim-note">(hive group; runs get _untreated / _&lt;treatment&gt;)</span>}</label>
              <input name="SimID" type="text" value={form.SimID} onChange={handleChange} placeholder="Auto-generated" />
            </div>

            {/* Timing */}
            <div className="sim-section">
              <label>Dates</label>
              <div className="sim-coord-row">
                <input name="SimulationStart" type="date" value={form.SimulationStart} onChange={handleChange} required />
                <input name="SimulationEnd" type="date" value={form.SimulationEnd} onChange={handleChange} required />
              </div>
            </div>

            <div className="sim-section">
              <label>Timesteps (days)</label>
              <input name="NumberBeeHaveTimesteps" type="number" min="1" value={form.NumberBeeHaveTimesteps} onChange={handleChange} required />
            </div>

            {/* Replicates & MC */}
            <div className="sim-section">
              <label>Replicates / MC runs</label>
              <div className="sim-coord-row">
                <input name="NumberBeeHaveReplicates" type="number" min="1" max="100" value={form.NumberBeeHaveReplicates} onChange={handleChange} required />
                <input name="NumberMC" type="number" min="1" value={form.NumberMC} onChange={handleChange} />
              </div>
            </div>

            {/* Random Seed */}
            <div className="sim-section">
              <label>Random Seed</label>
              <input name="BeeHaveRandomSeed" type="number" value={form.BeeHaveRandomSeed} onChange={handleChange} required />
            </div>

            {/* Weather */}
            <div className="sim-section">
              <label>Weather</label>
              <select name="BeeHaveWeather" value={form.BeeHaveWeather} onChange={handleChange}>
                <option value="Rothamsted (2009)">Scenario sunshine hours (Rothamsted model)</option>
                <option value="Weather File">Custom weather file</option>
              </select>
              {form.BeeHaveWeather === 'Weather File' && (
                <input name="BeeHaveWeatherFile" type="text" value={form.BeeHaveWeatherFile} onChange={handleChange} placeholder="Path to weather file" required />
              )}
            </div>

            {/* Treatment */}
            <div className="sim-section">
              <label>Pesticide treatment</label>
              <div className="sim-mode-toggle">
                <button type="button" className={form.treatmentMode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>Single run</button>
                <button type="button" className={form.treatmentMode === 'set' ? 'active' : ''} onClick={() => setMode('set')}>Untreated + treatments</button>
              </div>
            </div>

            {form.treatmentMode === 'single' && (
              <>
                <div className="sim-section">
                  <label>Product / GAP preset</label>
                  <select name="GAP" value={form.GAP} onChange={handleGapChange} disabled={gapsLoading} required>
                    {gaps.length === 0 && <option value="">— No presets available —</option>}
                    {gaps.map((g) => (
                      <option key={g.id} value={g.id}>{g.label}</option>
                    ))}
                  </select>
                </div>
                <div className="sim-section">
                  <label>Applications (min / max, 0 = untreated)</label>
                  <div className="sim-coord-row">
                    <input name="MinNumberApplications" type="number" min="0" value={form.MinNumberApplications} onChange={handleChange} required />
                    <input name="MaxNumberApplications" type="number" min="0" value={form.MaxNumberApplications} onChange={handleChange} required />
                  </div>
                </div>
                <GapCard
                  gap={selectedGap}
                  parameters={gapParameters}
                  overrides={form.overrides}
                  treatmentOn={treatmentOn}
                  onOverride={(key, value) => dispatch(setGapOverride({ key, value }))}
                  onClearOverrides={() => dispatch(clearGapOverrides())}
                />
              </>
            )}

            {form.treatmentMode === 'set' && (
              <div className="sim-section">
                <label>Treatments (one run each, plus an untreated run)</label>
                <div className="sim-treatment-row sim-treatment-head">
                  <span>name</span><span>GAP preset</span><span>min</span><span>max</span><span />
                </div>
                {form.treatments.map((t, index) => (
                  <div className="sim-treatment-row" key={index}>
                    <input
                      type="text"
                      placeholder="e.g. thiacloprid"
                      value={t.id}
                      onChange={(e) => dispatch(updateTreatment({ index, patch: { id: e.target.value.replace(/\s+/g, '_') } }))}
                      required
                    />
                    <select value={t.GAP} onChange={(e) => dispatch(updateTreatment({ index, patch: { GAP: e.target.value } }))}>
                      {gaps.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                    <input type="number" min="1" value={t.MinNumberApplications} onChange={(e) => dispatch(updateTreatment({ index, patch: { MinNumberApplications: Number(e.target.value) } }))} required />
                    <input type="number" min="1" value={t.MaxNumberApplications} onChange={(e) => dispatch(updateTreatment({ index, patch: { MaxNumberApplications: Number(e.target.value) } }))} required />
                    <button type="button" className="sim-link-btn" onClick={() => dispatch(removeTreatment(index))} title="remove">✕</button>
                  </div>
                ))}
                <div>
                  <button type="button" className="sim-link-btn" onClick={() => dispatch(addTreatment())}>+ add treatment</button>
                </div>
                <div className="sim-note">
                  Untreated run uses the toxicity values of preset “{selectedGap?.label || form.GAP}” with 0 applications.
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="sim-actions">
              <button type="button" className="sim-btn-reset" onClick={() => dispatch(resetForm())}>Reset</button>
              <button
                type="submit"
                className="sim-btn-launch"
                disabled={submitStatus === 'loading' || (form.treatmentMode === 'set' && form.treatments.length === 0)}
              >
                {submitStatus === 'loading'
                  ? 'Submitting...'
                  : form.treatmentMode === 'set'
                    ? `🚀 Launch ${form.treatments.length + 1} runs`
                    : '🚀 Launch'}
              </button>
            </div>

            {submitStatus === 'succeeded' && (
              <div className="sim-msg success">Simulation launched! Check Jobs tab.</div>
            )}
            {submitStatus === 'failed' && (
              <div className="sim-msg error">{submitError}</div>
            )}
          </form>
        )}

        {tab === 'jobs' && (
          <div className="sim-jobs">
            {jobs.length === 0 ? (
              <p className="sim-empty">No jobs yet.</p>
            ) : (
              jobs.map((job) => (
                <div key={job.job_id} className={`sim-job-card status-${job.status}`}>
                  <div className="sim-job-header">
                    <strong>{job.sim_id}</strong>
                    <span>{STATUS_LABELS[job.status]}</span>
                  </div>
                  <div className="sim-job-meta">
                    {formatDuration(job.started_at, job.finished_at)}
                    {job.params?.Project && ` · ${job.params.Project.split('/').pop()}`}
                    {job.params?.GAP && ` · ${job.params.GAP}`}
                  </div>
                  {job.error_message && (
                    <pre className="sim-job-error">{job.error_message.slice(-500)}</pre>
                  )}
                  <div className="sim-job-actions">
                    {['queued', 'running'].includes(job.status) && (
                      <button className="sim-btn-cancel" onClick={() => dispatch(cancelJob(job.job_id))}>Cancel</button>
                    )}
                    {job.status === 'done' && (
                      <button className="sim-btn-view" onClick={() => window.location.reload()}>
                        Refresh to view
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SimulationPanel;
