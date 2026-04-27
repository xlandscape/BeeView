import { configureStore } from '@reduxjs/toolkit';
import mapReducer from './slices/mapSlice';
import layerReducer from './slices/layerSlice'; // <-- Import your new slice
import runsReducer from './slices/runsSlice';
import selectionReducer from './reducers/selectionReducer';
import timeReducer from './timeSlice';

const store = configureStore({
  reducer: {
    map: mapReducer,
    layers: layerReducer,
    runs: runsReducer,
    selection: selectionReducer,
    time: timeReducer,
  },
});

export default store;