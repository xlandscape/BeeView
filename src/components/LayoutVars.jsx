import { useLayoutEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectInsets } from '../store/slices/uiSlice';

/**
 * Publishes the overlay insets as CSS custom properties on the document root, so
 * drawers, the simulation panel and the map's own widgets can position
 * themselves in CSS. Defaults live in App.css (:root) for the first paint.
 */
export default function LayoutVars() {
  const insets = useSelector(selectInsets);

  useLayoutEffect(() => {
    const style = document.documentElement.style;
    style.setProperty('--inset-top', `${insets.top}px`);
    style.setProperty('--inset-left', `${insets.left}px`);
    style.setProperty('--inset-right', `${insets.right}px`);
    style.setProperty('--inset-bottom', `${insets.bottom}px`);
  }, [insets]);

  return null;
}
