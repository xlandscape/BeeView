import { configureStore } from '@reduxjs/toolkit';
import mapReducer from './slices/mapSlice';
import exposureReducer from './slices/exposureSlice';
import layerReducer from './slices/layerSlice';
import runsReducer from './slices/runsSlice';
import simulationReducer from './slices/simulationSlice';
import uiReducer, { saveUiState } from './slices/uiSlice';
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
    ui: uiReducer,
  },
  // The dev-only immutability/serializability checks walk the entire state
  // tree after every action. With ~25k landscape features in state.map that
  // costs tens of milliseconds per dispatch, so they are disabled.
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ immutableCheck: false, serializableCheck: false }),
});

// Persist the layout (drawers, header, chart tab) shortly after it changes.
let lastUi = store.getState().ui;
let saveTimer = 0;
store.subscribe(() => {
  const ui = store.getState().ui;
  if (ui === lastUi) return;
  lastUi = ui;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveUiState(ui), 300);
});
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    clearTimeout(saveTimer);
    saveUiState(store.getState().ui);
  });
}

export default store;
