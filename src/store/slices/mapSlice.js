import { createSlice } from '@reduxjs/toolkit';

const mapSlice = createSlice({
  name: 'map',
  initialState: {
    activeL1Filters: [], // Tracks active L1_label filters
    landUseData: null,
    vegetationCodesMap: null,
    nectarMax: null,
    beePopulationData: null,
    beePopulationMetrics: [],
  },
  reducers: {
    toggleL1Filter: (state, action) => {
      const label = action.payload;
      if (state.activeL1Filters.includes(label)) {
        state.activeL1Filters = state.activeL1Filters.filter((item) => item !== label);
      } else {
        state.activeL1Filters.push(label);
      }
    },
    setLandUseData: (state, action) => {
      state.landUseData = action.payload;
    },
    setVegetationCodesMap: (state, action) => {
      state.vegetationCodesMap = action.payload;
    },
    setNectarMax: (state, action) => { 
      state.nectarMax = action.payload;
    },
    setBeePopulationData: (state, action) => {
      state.beePopulationData = action.payload;
    },
    setBeePopulationMetrics: (state, action) => {
      state.beePopulationMetrics = action.payload;
    }
  },
});

export const { toggleL1Filter, setLandUseData, setVegetationCodesMap, setNectarMax, setBeePopulationData, setBeePopulationMetrics } = mapSlice.actions;
export default mapSlice.reducer;