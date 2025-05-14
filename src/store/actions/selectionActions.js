import { selectFeature as selectFeatureAction, 
    clearSelection as clearSelectionAction,
    selectMultipleFeatures as selectMultipleFeaturesAction } from '../reducers/selectionReducer';

export const selectFeature = (featureId) => (dispatch) => {
dispatch(selectFeatureAction(featureId));
};

export const clearSelection = () => (dispatch) => {
dispatch(clearSelectionAction());
};

export const selectByLandUseType = (landUseType) => (dispatch, getState) => {
const { map } = getState();
const { landUseData } = map;

if (!landUseData || !landUseData.features) return;

const featureIds = landUseData.features
.filter(feature => feature.properties.landUseType === landUseType)
.map(feature => feature.id);

dispatch(selectMultipleFeaturesAction(featureIds));
};