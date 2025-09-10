import { createSlice } from '@reduxjs/toolkit';

const timeSlice = createSlice({
  name: 'time',
  initialState: {
    selectedTimePoint: null, // timestamp for selected point
    availableTimePoints: [],
  },
  reducers: {
    setSelectedTimePoint: (state, action) => {
      state.selectedTimePoint = action.payload;
    },
    setAvailableTimePoints: (state, action) => {
      state.availableTimePoints = action.payload;
    },
    clearSelectedTimePoint: (state) => {
      state.selectedTimePoint = null;
    },
  },
});

export const { 
  setSelectedTimePoint, 
  setAvailableTimePoints, 
  clearSelectedTimePoint 
} = timeSlice.actions;

export default timeSlice.reducer;
