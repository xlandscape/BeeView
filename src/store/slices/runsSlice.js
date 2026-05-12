import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { buildApiUrl } from '../../config/api';

// Default metric for compare view: total colony size (matches BEEHAVE column 1).
export const DEFAULT_COMPARE_METRIC =
  'TotalIHbees + TotalForagers + TotalDroneEggs + TotalEggs + TotalDroneLarvae + TotalLarvae + TotalDronePupae + TotalPupae';

export const fetchAvailableRuns = createAsyncThunk('runs/fetchAvailable', async () => {
  const response = await fetch(buildApiUrl('/api/runs'));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching /api/runs`);
  }
  const data = await response.json();
  return data.runs || [];
});

const initialState = {
  availableRuns: [],
  baselineRunId: null,
  scenarioRunId: null,
  // Independent of baseline/scenario: drives the non-compare tabs.
  viewRunIds: [],
  selectedMetric: DEFAULT_COMPARE_METRIC,
  threshold: 0.1,
  status: 'idle', // idle | loading | succeeded | failed
  error: null,
};

const runsSlice = createSlice({
  name: 'runs',
  initialState,
  reducers: {
    setBaselineRunId: (state, action) => {
      state.baselineRunId = action.payload;
    },
    setScenarioRunId: (state, action) => {
      state.scenarioRunId = action.payload;
    },
    setSelectedMetric: (state, action) => {
      state.selectedMetric = action.payload;
    },
    setThreshold: (state, action) => {
      state.threshold = action.payload;
    },
    clearRunSelection: (state) => {
      state.baselineRunId = null;
      state.scenarioRunId = null;
    },
    setViewRunIds: (state, action) => {
      state.viewRunIds = Array.from(new Set(action.payload || [])).sort((a, b) => a - b);
    },
    toggleViewRunId: (state, action) => {
      const id = action.payload;
      const idx = state.viewRunIds.indexOf(id);
      if (idx === -1) state.viewRunIds.push(id);
      else state.viewRunIds.splice(idx, 1);
      state.viewRunIds.sort((a, b) => a - b);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAvailableRuns.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAvailableRuns.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.availableRuns = action.payload;
      })
      .addCase(fetchAvailableRuns.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error?.message || 'Failed to fetch runs';
      });
  },
});

export const {
  setBaselineRunId,
  setScenarioRunId,
  setSelectedMetric,
  setThreshold,
  clearRunSelection,
  setViewRunIds,
  toggleViewRunId,
} = runsSlice.actions;

// Stable color palette for distinguishing runs in multi-run charts.
export const RUN_COLOR_PALETTE = [
  '#2563eb', // blue
  '#dc2626', // red
  '#059669', // green
  '#d97706', // amber
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#be185d', // pink
  '#65a30d', // lime
];

export const colorForRunId = (runId, viewRunIds) => {
  const idx = viewRunIds.indexOf(runId);
  if (idx === -1) return RUN_COLOR_PALETTE[0];
  return RUN_COLOR_PALETTE[idx % RUN_COLOR_PALETTE.length];
};

export default runsSlice.reducer;
