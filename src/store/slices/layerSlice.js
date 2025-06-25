import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  LULC: { visible: true },
  Pollen: { visible: false },
  Nectar: { visible: false },
};

const layerSlice = createSlice({
  name: 'layers',
  initialState,
  reducers: {
    toggleLayerVisibility: (state, action) => {
      const layer = action.payload;
      state[layer].visible = !state[layer].visible;
    },
    // Add more reducers for other layer properties as needed
  },
});

export const { toggleLayerVisibility } = layerSlice.actions;
export default layerSlice.reducer;