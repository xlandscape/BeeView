import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
// import DeckGL from '@deck.gl/react';
import {Map as MapLibre, NavigationControl, Popup, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {GeoJsonLayer} from 'deck.gl';
// import maplibregl from 'maplibre-gl'; // Import maplibre-gl
import 'maplibre-gl/dist/maplibre-gl.css';
// import LandUseLayer from './LandUseLayer';
// import MapControls from './MapControls';
// import { selectFeature } from '../../store/actions/selectionActions';

const INITIAL_VIEW_STATE = {
  latitude: 44.029,
  longitude: 1.135,
  zoom: 10,
  bearing: 0,
  pitch: 0
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

function DeckGLOverlay(props) {
  const overlay = useControl(() => new DeckOverlay(props));
  overlay.setProps(props);
  return null;
}

function Map() {
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [selected, setSelected] = useState(null);

  const activeFilters = useSelector((state) => state.map.activeL1Filters); // Access active filters from Redux


  // Load GeoJSON data
  useEffect(() => {
    async function loadGeoJson() {
      try {
        const response = await fetch('./data/Tarn_LULC_v04.geojson');
        const data = await response.json();
        setGeoJsonData(data);
      } catch (error) {
        console.error('Error loading GeoJSON:', error);
      }
    }
    loadGeoJson();
  }, []);

  const layers = [
    geoJsonData &&
      new GeoJsonLayer({
        id: 'geojson-layer',
        data: geoJsonData.features.filter((feature) =>
          activeFilters.length === 0 || activeFilters.includes(feature.properties.L1_label)
        ),
        filled: true,
        getFillColor: (feature) => {
          // Map L1_Label to a color
          const label = feature.properties.L1_label;
          switch (label) {
            case 'Forest':
              return [34, 139, 34, 180]; // Green
            case 'Water':
              return [0, 0, 255, 180]; // Blue
            case 'Developed':
              return [128, 128, 128, 180]; // Gray
            default:
              return [200, 200, 200, 180]; // Default color
          }
        },
        pickable: true,
        autoHighlight: true,
        onClick: (info) => setSelected(info.object),
      }),
  ];

  return (
    <MapLibre initialViewState={INITIAL_VIEW_STATE} mapStyle={MAP_STYLE}>
      {selected && (
        <Popup
          key={selected.properties.L1_label}
          anchor="bottom"
          style={{zIndex: 10}} /* position above deck.gl canvas */
          longitude={selected.geometry.coordinates[0][0][0]}
          latitude={selected.geometry.coordinates[0][0][1]}
        >
          <div>{selected.properties.L1_label}</div>
        </Popup>
      )}
      <DeckGLOverlay layers={layers} /* interleaved*/ />
      <NavigationControl position="top-left" />
    </MapLibre>
  );
}

export default Map;