import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toggleLayerVisibility } from '../../store/slices/layerSlice';

function LayerControls({ layer, label, children }) {
  const visible = useSelector(state => state.layers[layer]?.visible);
  const dispatch = useDispatch();

  return (
    <section className="layer-controls">
      <label>
        <input
          type="checkbox"
          checked={visible}
          onChange={() => dispatch(toggleLayerVisibility(layer))}
        />
        {label}
      </label>
      {visible && (
        <div className="layer-extra-controls">
          {children}
        </div>
      )}
    </section>
  );
}

export default LayerControls;