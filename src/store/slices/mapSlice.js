import { createSlice } from '@reduxjs/toolkit';

const mapSlice = createSlice({
  name: 'map',
  initialState: {
    activeL1Filters: [], // Tracks active L1_label filters
    landUseData: null,
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
    }
  },
});

export const { toggleL1Filter, setLandUseData } = mapSlice.actions;
export default mapSlice.reducer;