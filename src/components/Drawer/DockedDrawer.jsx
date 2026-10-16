import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Drawer from './index';
import { DRAWER_LIMITS, setDrawerSize, toggleDrawer } from '../../store/slices/uiSlice';

/**
 * Drawer bound to state.ui.drawers[id]. Subscribes locally, so dragging a drawer
 * re-renders this component only and not the whole app tree.
 */
export default function DockedDrawer({ id, title, toolbar, persistentHeader, children }) {
  const dispatch = useDispatch();
  const { open, size } = useSelector((state) => state.ui.drawers[id]);
  const limits = DRAWER_LIMITS[id];

  const onToggle = useCallback(() => dispatch(toggleDrawer(id)), [dispatch, id]);
  const onResize = useCallback((next) => dispatch(setDrawerSize({ side: id, size: next })), [dispatch, id]);

  return (
    <Drawer
      side={id}
      title={title}
      open={open}
      size={size}
      min={limits.min}
      max={limits.max}
      defaultSize={limits.default}
      onToggle={onToggle}
      onResize={onResize}
      toolbar={toolbar}
      persistentHeader={persistentHeader}
    >
      {children}
    </Drawer>
  );
}
