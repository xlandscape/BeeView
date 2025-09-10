import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  LULC: { visible: true },
  Pollen: { visible: false },
  Nectar: { visible: false },
  // Bee population layers
  TotalEggs: { visible: false },
  TotalLarvae: { visible: false },
  TotalPupae: { visible: false },
  TotalIHbees: { visible: false },
  TotalForagers: { visible: false },
  TotalWorkers: { visible: false }, // This will be "totalIHbees + totalForagers"
  TotalDroneEggs: { visible: false },
  TotalDroneLarvae: { visible: false },
  TotalDronePupae: { visible: false },
  TotalDrones: { visible: false },
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