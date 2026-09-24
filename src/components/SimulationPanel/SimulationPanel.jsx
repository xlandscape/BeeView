import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchScenarios,
  fetchScenarioBounds,
  submitSimulation,
  fetchJobs,
  cancelJob,
  updateForm,
  resetForm,
  setHivePlacementMode,
  closeSimulationPanel,
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

function SimulationPanel() {
  const dispatch = useDispatch();
  const {
    form, scenarios, scenariosLoading, submitStatus, submitError,
    jobs, hivePlacementMode,
  } = useSelector((state) => state.simulation);
  const [tab, setTab] = useState('form');

  useEffect(() => {
    dispatch(fetchScenarios());
    dispatch(fetchJobs());
  }, [dispatch]);

  // Poll jobs when on jobs tab or when there are active jobs
  useEffect(() => {
    const hasActive = jobs.some((j) => ['queued', 'running', 'importing'].includes(j.status));
    if (tab === 'jobs' || hasActive) {
      const interval = setInterval(() => dispatch(fetchJobs()), 5000);
      return () => clearInterval(interval);
    }
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const params = { ...form };
    if (!params.SimID) params.SimID = `run_${Date.now().toString(36)}`;
    if (!params.BeeHaveWeatherFile) delete params.BeeHaveWeatherFile;
    if (!params.RunLabel) delete params.RunLabel;
    if (!params.HiveGroupId) delete params.HiveGroupId;
    dispatch(submitSimulation(params));
  };

  const selectedScenarioFolder = scenarios.find((s) => s.path === form.Project)?.folder_name || '';
  const activeJobCount = jobs.filter((j) => ['queued', 'running', 'importing'].includes(j.status)).length;

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
              <label>Simulation ID</label>
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
                <option value="Rothamsted (2009)">Rothamsted (2009)</option>
                <option value="Weather File">Custom File</option>
              </select>
              {form.BeeHaveWeather === 'Weather File' && (
                <input name="BeeHaveWeatherFile" type="text" value={form.BeeHaveWeatherFile} onChange={handleChange} placeholder="Path to weather file" required />
              )}
            </div>

            {/* Treatment */}
            <div className="sim-section">
              <label>Pesticide Applications (min / max)</label>
              <div className="sim-coord-row">
                <input name="MinNumberApplications" type="number" min="0" value={form.MinNumberApplications} onChange={handleChange} required />
                <input name="MaxNumberApplications" type="number" min="0" value={form.MaxNumberApplications} onChange={handleChange} required />
              </div>
            </div>

            {/* Actions */}
            <div className="sim-actions">
              <button type="button" className="sim-btn-reset" onClick={() => dispatch(resetForm())}>Reset</button>
              <button type="submit" className="sim-btn-launch" disabled={submitStatus === 'loading'}>
                {submitStatus === 'loading' ? 'Submitting...' : '🚀 Launch'}
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
