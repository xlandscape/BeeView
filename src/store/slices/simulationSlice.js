import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { buildApiUrl } from '../../config/api';

// Thunks

export const fetchScenarios = createAsyncThunk('simulation/fetchScenarios', async () => {
  const res = await fetch(buildApiUrl('/api/scenarios'));
  if (!res.ok) throw new Error('Failed to fetch scenarios');
  return res.json();
});

export const fetchScenarioBounds = createAsyncThunk('simulation/fetchScenarioBounds', async (folderName) => {
  const res = await fetch(buildApiUrl(`/api/scenarios/${folderName}/bounds`));
  if (!res.ok) throw new Error('Failed to fetch scenario bounds');
  return res.json();
});

export const fetchGaps = createAsyncThunk('simulation/fetchGaps', async () => {
  const res = await fetch(buildApiUrl('/api/gaps'));
  if (!res.ok) throw new Error('Failed to fetch GAP presets');
  return res.json();
});

export const saveGapPreset = createAsyncThunk('simulation/saveGapPreset', async (preset, { dispatch, rejectWithValue }) => {
  const res = await fetch(buildApiUrl('/api/gaps'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.detail || 'Could not save the preset');
  await dispatch(fetchGaps());
  return data;
});

export const submitSimulation = createAsyncThunk('simulation/submit', async (params, { rejectWithValue }) => {
  const res = await fetch(buildApiUrl('/api/simulate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) return rejectWithValue(data.detail || 'Submission failed');
  return data;
});

export const fetchJobs = createAsyncThunk('simulation/fetchJobs', async () => {
  const res = await fetch(buildApiUrl('/api/simulate/jobs'));
  if (!res.ok) throw new Error('Failed to fetch jobs');
  return res.json();
});

export const cancelJob = createAsyncThunk('simulation/cancelJob', async (jobId) => {
  const res = await fetch(buildApiUrl(`/api/simulate/jobs/${jobId}`), { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to cancel job');
  return jobId;
});

// Initial form state
const defaultForm = {
  SimID: '',
  Project: '',
  SimulationStart: '2021-01-01',
  SimulationEnd: '2021-12-31',
  NumberBeeHaveTimesteps: 365,
  BeeHaveMapCenterPointX: '',
  BeeHaveMapCenterPointY: '',
  NumberBeeHaveReplicates: 1,
  BeeHaveRandomSeed: 1,
  BeeHaveWeather: 'Rothamsted (2009)',
  BeeHaveWeatherFile: '',
  MinNumberApplications: 0,
  MaxNumberApplications: 0,
  RunLabel: '',
  HiveGroupId: '',
  NumberMC: 1,
  // Treatment: GAP preset id, per-parameter overrides of that preset, and
  // (treatment-set mode) the list of treated variants to run next to an untreated run.
  GAP: 'default',
  overrides: {},
  treatmentMode: 'single', // 'single' | 'set'
  treatments: [],
};

export const newTreatment = (gapId = 'default') => ({
  id: '',
  GAP: gapId,
  MinNumberApplications: 1,
  MaxNumberApplications: 1,
});

const simulationSlice = createSlice({
  name: 'simulation',
  initialState: {
    panelOpen: false,
    hivePlacementMode: false,
    form: { ...defaultForm },
    scenarios: [],
    scenarioBounds: null,
    gaps: [],
    gapParameters: {},
    gapsLoading: false,
    presetSaveStatus: 'idle', // idle | loading | succeeded | failed
    presetSaveError: null,
    jobs: [],
    submitStatus: 'idle', // idle | loading | succeeded | failed
    submitError: null,
    scenariosLoading: false,
  },
  reducers: {
    toggleSimulationPanel(state) {
      state.panelOpen = !state.panelOpen;
      if (!state.panelOpen) {
        state.hivePlacementMode = false;
      }
    },
    closeSimulationPanel(state) {
      state.panelOpen = false;
      state.hivePlacementMode = false;
    },
    setHivePlacementMode(state, action) {
      state.hivePlacementMode = action.payload;
    },
    updateForm(state, action) {
      Object.assign(state.form, action.payload);
    },
    resetForm(state) {
      state.form = { ...defaultForm };
      state.scenarioBounds = null;
      state.submitStatus = 'idle';
      state.submitError = null;
    },
    setGapOverride(state, action) {
      const { key, value } = action.payload;
      if (value === null || value === undefined || value === '') delete state.form.overrides[key];
      else state.form.overrides[key] = value;
    },
    clearGapOverrides(state) {
      state.form.overrides = {};
    },
    setTreatmentMode(state, action) {
      state.form.treatmentMode = action.payload;
      if (action.payload === 'set' && state.form.treatments.length === 0) {
        state.form.treatments = [{ ...newTreatment(state.form.GAP), id: 'treated' }];
      }
    },
    addTreatment(state) {
      state.form.treatments.push(newTreatment(state.form.GAP));
    },
    updateTreatment(state, action) {
      const { index, patch } = action.payload;
      if (state.form.treatments[index]) Object.assign(state.form.treatments[index], patch);
    },
    removeTreatment(state, action) {
      state.form.treatments.splice(action.payload, 1);
    },
    resetPresetSave(state) {
      state.presetSaveStatus = 'idle';
      state.presetSaveError = null;
    },
    setHivePosition(state, action) {
      const { x, y } = action.payload;
      state.form.BeeHaveMapCenterPointX = x;
      state.form.BeeHaveMapCenterPointY = y;
      state.hivePlacementMode = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchScenarios.pending, (state) => { state.scenariosLoading = true; })
      .addCase(fetchScenarios.fulfilled, (state, action) => {
        state.scenarios = action.payload;
        state.scenariosLoading = false;
      })
      .addCase(fetchScenarios.rejected, (state) => { state.scenariosLoading = false; })
      .addCase(fetchGaps.pending, (state) => { state.gapsLoading = true; })
      .addCase(fetchGaps.fulfilled, (state, action) => {
        state.gaps = action.payload.gaps || [];
        state.gapParameters = action.payload.parameters || {};
        state.gapsLoading = false;
        if (state.gaps.length > 0 && !state.gaps.some((g) => g.id === state.form.GAP)) {
          state.form.GAP = state.gaps[0].id;
        }
      })
      .addCase(fetchGaps.rejected, (state) => { state.gapsLoading = false; })
      .addCase(saveGapPreset.pending, (state) => {
        state.presetSaveStatus = 'loading';
        state.presetSaveError = null;
      })
      .addCase(saveGapPreset.fulfilled, (state, action) => {
        state.presetSaveStatus = 'succeeded';
        state.form.GAP = action.payload.id;
        state.form.overrides = {};
      })
      .addCase(saveGapPreset.rejected, (state, action) => {
        state.presetSaveStatus = 'failed';
        state.presetSaveError = action.payload || action.error.message;
      })
      .addCase(fetchScenarioBounds.fulfilled, (state, action) => {
        state.scenarioBounds = action.payload;
        if (!state.form.BeeHaveMapCenterPointX) {
          state.form.BeeHaveMapCenterPointX = action.payload.center_x;
          state.form.BeeHaveMapCenterPointY = action.payload.center_y;
        }
      })
      .addCase(submitSimulation.pending, (state) => {
        state.submitStatus = 'loading';
        state.submitError = null;
      })
      .addCase(submitSimulation.fulfilled, (state) => {
        state.submitStatus = 'succeeded';
      })
      .addCase(submitSimulation.rejected, (state, action) => {
        state.submitStatus = 'failed';
        state.submitError = action.payload || action.error.message;
      })
      .addCase(fetchJobs.fulfilled, (state, action) => {
        state.jobs = action.payload;
      });
  },
});

export const {
  toggleSimulationPanel,
  closeSimulationPanel,
  setHivePlacementMode,
  updateForm,
  resetForm,
  setHivePosition,
  setGapOverride,
  clearGapOverrides,
  setTreatmentMode,
  addTreatment,
  updateTreatment,
  removeTreatment,
  resetPresetSave,
} = simulationSlice.actions;

export default simulationSlice.reducer;
