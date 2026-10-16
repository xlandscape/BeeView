import React, { useCallback, useEffect, useRef } from 'react';
import './Drawer.css';

const ARROWS = {
  left: { open: '‹', closed: '›' },
  right: { open: '›', closed: '‹' },
  bottom: { open: '▾', closed: '▴' },
};

/**
 * Generic docked drawer rendered above the map.
 *
 * Children stay mounted while collapsed (the body is hidden), so charts keep their
 * state, effects and keyboard handlers. Side drawers collapse to a vertical tab;
 * with `persistentHeader` (bottom drawer) the header strip stays visible so its
 * toolbar (chart tabs, day slider) remains usable.
 */
export default function Drawer({
  side,
  title,
  open,
  size,
  min,
  max,
  defaultSize,
  onToggle,
  onResize,
  toolbar = null,
  persistentHeader = false,
  children,
}) {
  const drag = useRef(null);
  const frame = useRef(0);
  const asideRef = useRef(null);

  const clamp = useCallback((value) => Math.max(min, Math.min(max, Math.round(value))), [min, max]);

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, startSize: size, pointerId: e.pointerId };
    document.body.classList.add('drawer-resizing', side === 'bottom' ? 'drawer-resizing-row' : 'drawer-resizing-col');
    asideRef.current?.classList.add('is-resizing');
  }, [size, side]);

  const sizeFromEvent = useCallback((e) => {
    const d = drag.current;
    if (!d) return null;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const delta = side === 'left' ? dx : side === 'right' ? -dx : -dy;
    return clamp(d.startSize + delta);
  }, [clamp, side]);

  const onPointerMove = useCallback((e) => {
    if (!drag.current) return;
    const next = sizeFromEvent(e);
    if (next === null) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => onResize(next));
  }, [onResize, sizeFromEvent]);

  const endDrag = useCallback((e) => {
    if (!drag.current) return;
    const next = sizeFromEvent(e);
    drag.current = null;
    cancelAnimationFrame(frame.current);
    document.body.classList.remove('drawer-resizing', 'drawer-resizing-row', 'drawer-resizing-col');
    asideRef.current?.classList.remove('is-resizing');
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (next !== null) onResize(next);
  }, [onResize, sizeFromEvent]);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    document.body.classList.remove('drawer-resizing', 'drawer-resizing-row', 'drawer-resizing-col');
  }, []);

  const arrow = ARROWS[side] || ARROWS.left;
  const collapsedTab = !open && !persistentHeader;

  return (
    <aside
      ref={asideRef}
      className={`drawer drawer--${side} ${open ? 'is-open' : 'is-collapsed'}`}
      style={{ '--drawer-size': `${size}px` }}
      aria-label={title}
    >
      {collapsedTab ? (
        <button type="button" className="drawer__tab" onClick={onToggle} title={`Show ${title}`} aria-expanded={false}>
          {title}
        </button>
      ) : (
        <div className="drawer__header">
          <button
            type="button"
            className="drawer__toggle"
            onClick={onToggle}
            title={open ? `Hide ${title}` : `Show ${title}`}
            aria-expanded={open}
          >
            {open ? arrow.open : arrow.closed}
          </button>
          <span className="drawer__title">{title}</span>
          {toolbar && <div className="drawer__toolbar">{toolbar}</div>}
        </div>
      )}
      <div className="drawer__body" hidden={!open}>
        {children}
      </div>
      {open && (
        <div
          className="drawer__resizer"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => defaultSize && onResize(defaultSize)}
          title="Drag to resize, double-click to reset"
        />
      )}
    </aside>
  );
}
