import { setLandUseData, setLoading, setError } from '../reducers/mapReducer';

export const fetchLandUseData = () => async (dispatch) => {
  dispatch(setLoading(true));
  
  try {
    const response = await fetch('/data/sample-landuse.geojson');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: \${response.status}`);
    }
    
    const data = await response.json();
    dispatch(setLandUseData(data));
  } catch (error) {
    console.error("Error fetching land use data:", error);
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};