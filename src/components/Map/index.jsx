import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setLandUseData, setNectarMax } from '../../store/slices/mapSlice';
// import DeckGL from '@deck.gl/react';
import {Map as MapLibre, NavigationControl, Popup, useControl} from 'react-map-gl/maplibre';
import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import {GeoJsonLayer} from 'deck.gl';
import { getLandUseColor, getNectarColor, getPollenColor } from '../../utils/colorScales';
// import maplibregl from 'maplibre-gl'; // Import maplibre-gl
import 'maplibre-gl/dist/maplibre-gl.css';
// import LandUseLayer from './LandUseLayer';
// import MapControls from './MapControls';
import { selectFeature } from '../../store/reducers/selectionReducer';
import { loadNectarMaxValues } from '../../utils/nectarLoader';

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
  const dispatch = useDispatch();
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [nectarMax, setNectarData] = useState(null);
  const [pollenMax, setPollenData] = useState(null);
  const [selected, setSelected] = useState(null);

  const activeFilters = useSelector((state) => state.map.activeL1Filters);
  const layerVisibility = useSelector(state => state.layers);

  // Load GeoJSON data
  useEffect(() => {
    async function loadGeoJson() {
      try {
        const data = await fetch('http://127.0.0.1:8080/geojson').then(res => res.json());
        if (!data || !data.features) {
          throw new Error('Invalid GeoJSON data');
        }
        setGeoJsonData(data);
        dispatch(setLandUseData(data));
      } catch (error) {
        console.error('Error loading GeoJSON:', error);
      }
    }
    loadGeoJson();
  }, [dispatch]);

  // Load Nectar max values
  useEffect(() => {
    async function loadNectarMax() {
      try {
        const nectarMaxValues = await fetch('http://127.0.0.1:8080/nectar/max').then(res => res.json());
        // Convert array to lookup object
        const nectarMaxLookup = {};
        nectarMaxValues["max_nectar"].forEach(item => {
          nectarMaxLookup[item.feature_id] = item.max_nectar;
        });
        setNectarData(nectarMaxLookup);
        dispatch(setNectarMax(nectarMaxLookup));
      } catch (error) {
        console.error('Error loading Nectar max values:', error);
      }
    }
    loadNectarMax();
  }, [dispatch]);

  // Load Pollen max values
  useEffect(() => {
    async function loadPollenMax() {
      try {
        const pollenMaxValues = await fetch('http://127.0.0.1:8080/pollen/max').then(res => res.json());
        // Convert array to lookup object
        const pollenMaxLookup = {};
        pollenMaxValues["max_pollen"].forEach(item => {
          pollenMaxLookup[item.feature_id] = item.max_pollen;
        });
        setPollenData(pollenMaxLookup);
      } catch (error) {
        console.error('Error loading Pollen max values:', error);
      }
    }
    loadPollenMax();
  }, [dispatch]);

  const layers = [
    layerVisibility.LULC.visible && 
    geoJsonData &&
      new GeoJsonLayer({
        id: 'geojson-layer',
        data: geoJsonData.features.filter((feature) =>
          activeFilters.length === 0 || activeFilters.includes(feature.properties.L1_label)
        ),
        filled: true,
        getFillColor: (feature, {index}) => {
          return getLandUseColor(feature.properties.L1_label);
      },
        pickable: true,
        autoHighlight: true,
        onClick: (info) => setSelected(info.object),
      }),
    layerVisibility.Nectar.visible && 
    nectarMax &&
      new GeoJsonLayer({ 
        id: 'nectar-layer',
        data: geoJsonData.features.filter((feature) =>
          activeFilters.length === 0 || activeFilters.includes(feature.properties.L1_label)
        ),
        filled: true,
        getFillColor: (feature, {index}) => {
          if (!nectarMax || !nectarMax[feature.id]) {
            return [200, 200, 200, 100];
          }
          const nectar = nectarMax[feature.id];
          return getNectarColor(nectar);
        },
        pickable: true,
        autoHighlight: true,
        onClick: info => {
          if (info.object) {
            dispatch(selectFeature([info.object.id]));
          }
        },
      }),
    layerVisibility.Pollen?.visible && 
    pollenMax &&
      new GeoJsonLayer({ 
        id: 'pollen-layer',
        data: geoJsonData.features.filter((feature) =>
          activeFilters.length === 0 || activeFilters.includes(feature.properties.L1_label)
        ),
        filled: true,
        getFillColor: (feature, {index}) => {
          if (!pollenMax || !pollenMax[feature.id]) {
            return [200, 200, 200, 100];
          }
          const pollen = pollenMax[feature.id];
          return typeof getPollenColor === 'function' ? getPollenColor(pollen) : [255, 200, 0, 180];
        },
        pickable: true,
        autoHighlight: true,
        onClick: info => {
          if (info.object) {
            dispatch(selectFeature([info.object.id]));
          }
        },
      }),
  ].filter(Boolean);

  if (!nectarMax) {
    return <div>Loading nectar data...</div>;
  }

  return (
    <MapLibre initialViewState={INITIAL_VIEW_STATE} mapStyle={MAP_STYLE}>
      {selected && (
        <Popup
          key={selected.properties.L1_label}
          anchor="bottom"
          style={{zIndex: 10}} /* position above deck.gl canvas */
          longitude={selected.geometry.coordinates[0][0][0][0]}
          latitude={selected.geometry.coordinates[0][0][0][1]}
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