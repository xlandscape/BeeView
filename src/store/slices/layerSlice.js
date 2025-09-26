import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  LULC: { visible: true },
  Pollen: { visible: false },
  Nectar: { visible: false },
  Beehive: { visible: false },
  Vegetation: { visible: false },
  // Bee population layers - updated to match actual metrics from load_bee_population.py
  TotalColony: { visible: false }, // All bees + all brood (TotalIHbees + TotalForagers + TotalDroneEggs + TotalEggs + TotalDroneLarvae + TotalLarvae + TotalDronePupae + TotalPupae)
  TotalAdults: { visible: false }, // Adults/Workers (TotalIHbees + TotalForagers)
  AllEggs: { visible: false }, // All eggs combined (TotalDroneEggs + TotalEggs)
  AllLarvae: { visible: false }, // All larvae combined (TotalDroneLarvae + TotalLarvae)
  AllPupae: { visible: false }, // All pupae combined (TotalDronePupae + TotalPupae)
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