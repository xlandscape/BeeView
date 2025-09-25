import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  landUseData: null,
  vegetationCodesMap: null,
  visibleLayers: {
    landUse: true,
    baseMap: true
  },
  isLoading: false,
  error: null
};

const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    setLandUseData: (state, action) => {
      state.landUseData = action.payload;
    },
    setVegetationCodesMap: (state, action) => {
      state.vegetationCodesMap = action.payload;
    },
    toggleLayer: (state, action) => {
      state.visibleLayers[action.payload] = !state.visibleLayers[action.payload];
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    }
  }
});

export const { setLandUseData, setVegetationCodesMap, toggleLayer, setLoading, setError } = mapSlice.actions;

export default mapSlice.reducer;