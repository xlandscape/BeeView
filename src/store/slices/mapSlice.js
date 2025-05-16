import { createSlice } from '@reduxjs/toolkit';

const mapSlice = createSlice({
  name: 'map',
  initialState: {
    activeL1Filters: [], // Tracks active L1_label filters
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
  },
});

export const { toggleL1Filter } = mapSlice.actions;
export default mapSlice.reducer;