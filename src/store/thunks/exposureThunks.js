import { createAsyncThunk } from '@reduxjs/toolkit';
import { buildApiUrl } from '../../config/api';

export const normalizeFeatureIds = (featureIds = []) =>
  Array.from(new Set((featureIds || []).map(Number).filter(Number.isFinite))).sort((a, b) => a - b);

export const buildExposureRequestKey = (runId = null, featureIds = []) => {
  const normalizedFeatureIds = normalizeFeatureIds(featureIds);
  const featureKey = normalizedFeatureIds.length > 0 ? normalizedFeatureIds.join(',') : 'all';
  return `${runId ?? 'default'}::${featureKey}`;
};

const appendQueryParams = (path, runId, featureIds) => {
  const params = new URLSearchParams();
  if (runId != null) {
    params.set('run_id', String(runId));
  }

  const normalizedFeatureIds = normalizeFeatureIds(featureIds);
  if (normalizedFeatureIds.length > 0) {
    params.set('feature_ids', normalizedFeatureIds.join(','));
  }

  const query = params.toString();
  return buildApiUrl(query ? `${path}?${query}` : path);
};

export const fetchExposureTimeseries = createAsyncThunk(
  'exposure/fetchTimeseries',
  async ({ runId = null, featureIds = [] } = {}, { rejectWithValue }) => {
    const requestKey = buildExposureRequestKey(runId, featureIds);
    try {
      const response = await fetch(appendQueryParams('/api/exposure/timeseries', runId, featureIds));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching exposure timeseries`);
      }

      const data = await response.json();
      return {
        requestKey,
        runId,
        featureIds: normalizeFeatureIds(featureIds),
        exposureTimeseries: data.exposure_timeseries || [],
      };
    } catch (error) {
      return rejectWithValue({
        requestKey,
        runId,
        featureIds: normalizeFeatureIds(featureIds),
        message: error.message || 'Failed to fetch exposure timeseries',
      });
    }
  }
);

export const fetchApplications = createAsyncThunk(
  'exposure/fetchApplications',
  async ({ runId = null, featureIds = [] } = {}, { rejectWithValue }) => {
    const requestKey = buildExposureRequestKey(runId, featureIds);
    try {
      const response = await fetch(appendQueryParams('/api/applications', runId, featureIds));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching applications`);
      }

      const data = await response.json();
      return {
        requestKey,
        runId,
        featureIds: normalizeFeatureIds(featureIds),
        applications: data.applications || [],
      };
    } catch (error) {
      return rejectWithValue({
        requestKey,
        runId,
        featureIds: normalizeFeatureIds(featureIds),
        message: error.message || 'Failed to fetch applications',
      });
    }
  }
);