import { createSlice } from '@reduxjs/toolkit';
import {
  applicationsRequestKey,
  buildExposureRequestKey,
  fetchApplications,
  fetchExposureTimeseries,
} from '../thunks/exposureThunks';

const ensureRequestState = (state, requestKey, runId, featureIds) => {
  if (!state.requests[requestKey]) {
    state.requests[requestKey] = {
      requestKey,
      runId,
      featureIds,
      exposureTimeseries: [],
      applications: [],
      exposureStatus: 'idle',
      applicationsStatus: 'idle',
      exposureError: null,
      applicationsError: null,
    };
  }

  return state.requests[requestKey];
};

const initialState = {
  requests: {},
};

const exposureSlice = createSlice({
  name: 'exposure',
  initialState,
  reducers: {
    clearExposureCache: (state) => {
      state.requests = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExposureTimeseries.pending, (state, action) => {
        const { runId = null, featureIds = [] } = action.meta.arg || {};
        const requestKey = buildExposureRequestKey(runId, featureIds);
        const request = ensureRequestState(state, requestKey, runId, featureIds);
        request.exposureStatus = 'loading';
        request.exposureError = null;
      })
      .addCase(fetchExposureTimeseries.fulfilled, (state, action) => {
        const { requestKey, runId, featureIds, exposureTimeseries } = action.payload;
        const request = ensureRequestState(state, requestKey, runId, featureIds);
        request.runId = runId;
        request.featureIds = featureIds;
        request.exposureTimeseries = exposureTimeseries;
        request.exposureStatus = 'succeeded';
        request.exposureError = null;
      })
      .addCase(fetchExposureTimeseries.rejected, (state, action) => {
        const payload = action.payload || {};
        const { runId = null, featureIds = [], requestKey = buildExposureRequestKey(runId, featureIds) } = payload;
        const request = ensureRequestState(state, requestKey, runId, featureIds);
        request.exposureStatus = 'failed';
        request.exposureError = payload.message || action.error?.message || 'Failed to fetch exposure timeseries';
        request.exposureTimeseries = [];
      })
      .addCase(fetchApplications.pending, (state, action) => {
        const { runId = null } = action.meta.arg || {};
        const requestKey = applicationsRequestKey(runId);
        const request = ensureRequestState(state, requestKey, runId, []);
        request.applicationsStatus = 'loading';
        request.applicationsError = null;
      })
      .addCase(fetchApplications.fulfilled, (state, action) => {
        const { requestKey, runId, featureIds, applications } = action.payload;
        const request = ensureRequestState(state, requestKey, runId, featureIds);
        request.runId = runId;
        request.featureIds = featureIds;
        request.applications = applications;
        request.applicationsStatus = 'succeeded';
        request.applicationsError = null;
      })
      .addCase(fetchApplications.rejected, (state, action) => {
        const payload = action.payload || {};
        const { runId = null, featureIds = [], requestKey = applicationsRequestKey(runId) } = payload;
        const request = ensureRequestState(state, requestKey, runId, featureIds);
        request.applicationsStatus = 'failed';
        request.applicationsError = payload.message || action.error?.message || 'Failed to fetch applications';
        request.applications = [];
      });
  },
});

export const { clearExposureCache } = exposureSlice.actions;

export default exposureSlice.reducer;