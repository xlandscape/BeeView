import { createSlice } from '@reduxjs/toolkit';

const timeSlice = createSlice({
  name: 'time',
  initialState: {
    selectedTimePoint: null, // day index (1-based) of the selected point
    availableTimePoints: [],
    dayCount: 365, // upper bound for day navigation (longest loaded series)
  },
  reducers: {
    setSelectedTimePoint: (state, action) => {
      state.selectedTimePoint = action.payload;
    },
    setAvailableTimePoints: (state, action) => {
      state.availableTimePoints = action.payload;
    },
    setDayCount: (state, action) => {
      const n = Number(action.payload);
      if (Number.isFinite(n) && n >= 1) state.dayCount = Math.round(n);
    },
    clearSelectedTimePoint: (state) => {
      state.selectedTimePoint = null;
    },
  },
});

export const {
  setSelectedTimePoint,
  setAvailableTimePoints,
  setDayCount,
  clearSelectedTimePoint,
} = timeSlice.actions;

export default timeSlice.reducer;
