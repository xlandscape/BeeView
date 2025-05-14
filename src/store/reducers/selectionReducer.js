import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  selectedFeatureIds: []
};

const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    selectFeature: (state, action) => {
      const featureId = action.payload;
      if (state.selectedFeatureIds.includes(featureId)) {
        state.selectedFeatureIds = state.selectedFeatureIds.filter(id => id !== featureId);
      } else {
        state.selectedFeatureIds.push(featureId);
      }
    },
    clearSelection: (state) => {
      state.selectedFeatureIds = [];
    },
    selectMultipleFeatures: (state, action) => {
      state.selectedFeatureIds = action.payload;
    }
  }
});

export const { selectFeature, clearSelection, selectMultipleFeatures } = selectionSlice.actions;

export default selectionSlice.reducer;