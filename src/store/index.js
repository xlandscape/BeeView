import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './reducers';
import mapReducer from './slices/mapSlice';

const store = configureStore({
  reducer: {
    map: mapReducer, // Add the map slice here
  },
});

export default store;