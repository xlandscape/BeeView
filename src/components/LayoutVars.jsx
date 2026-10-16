import { useLayoutEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectInsets } from '../store/slices/uiSlice';

/**
 * Writes the overlay insets as CSS custom properties on the app shell, so drawers,
 * the simulation panel and the map's own widgets can position themselves in CSS.
 */
export default function LayoutVars({ shellRef }) {
  const insets = useSelector(selectInsets);

  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    el.style.setProperty('--inset-top', `${insets.top}px`);
    el.style.setProperty('--inset-left', `${insets.left}px`);
    el.style.setProperty('--inset-right', `${insets.right}px`);
    el.style.setProperty('--inset-bottom', `${insets.bottom}px`);
  }, [shellRef, insets]);

  return null;
}
