import { GeoJsonLayer } from '@deck.gl/layers';
import { useSelector } from 'react-redux';
import { getLandUseColor } from '../../utils/colorScales';

function LandUseLayer({ selectedFeatureIds, onClick }) {
  const landUseData = useSelector(state => state.map.landUseData);

  return new GeoJsonLayer({
    id: 'land-use-layer',
    data: landUseData,
    pickable: true,
    stroked: true,
    filled: true,
    extruded: false,
    lineWidthScale: 1,
    lineWidthMinPixels: 1,
    getFillColor: d => {
      const isSelected = selectedFeatureIds.includes(d.id);
      const color = getLandUseColor(d.properties.landUseType);
      return isSelected ? [color[0], color[1], color[2], 255] : [color[0], color[1], color[2], 180];
    },
    getLineColor: [80, 80, 80, 255],
    getLineWidth: d => selectedFeatureIds.includes(d.id) ? 2 : 1,
    onClick
  });
}

export default LandUseLayer;