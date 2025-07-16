// src/store/thunks/dataLoader.ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import { fetchSimulationData } from '../../api/simulationService';

export const loadSimulationData = createAsyncThunk(
  'simulation/loadData',
  async (scenarioId, { rejectWithValue }) => {
    try {
      const data = await fetchSimulationData(scenarioId);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);