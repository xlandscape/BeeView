import { combineReducers } from 'redux';
import mapReducer from './mapReducer';
import selectionReducer from './selectionReducer';

const rootReducer = combineReducers({
  map: mapReducer,
  selection: selectionReducer
});

export default rootReducer;