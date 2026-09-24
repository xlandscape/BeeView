import { configureStore } from '@reduxjs/toolkit';
import mapReducer from './slices/mapSlice';
import exposureReducer from './slices/exposureSlice';
import layerReducer from './slices/layerSlice'; // <-- Import your new slice
import runsReducer from './slices/runsSlice';
import simulationReducer from './slices/simulationSlice';
import selectionReducer from './reducers/selectionReducer';
import timeReducer from './timeSlice';

const store = configureStore({
  reducer: {
    exposure: exposureReducer,
    map: mapReducer,
    layers: layerReducer,
    runs: runsReducer,
    simulation: simulationReducer,
    selection: selectionReducer,
    time: timeReducer,
  },
  // The dev-only immutability/serializability checks walk the entire state
  // tree after every action. With ~25k landscape features in state.map that
  // costs tens of milliseconds per dispatch, so they are disabled.
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ immutableCheck: false, serializableCheck: false }),
});

export default store;