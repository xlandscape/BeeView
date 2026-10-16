import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Measure an element with ResizeObserver.
 *
 *   const [ref, { width, height }] = useContainerSize({ debounceMs: 80 });
 *
 * Sizes are rounded, updates are coalesced per animation frame (optionally
 * debounced for expensive redraws such as d3 charts), and 0x0 measurements
 * (element hidden with `hidden` / display:none) are ignored so consumers keep the
 * last real size until the element is visible again.
 */
export default function useContainerSize({ debounceMs = 0 } = {}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [node, setNode] = useState(null);
  const frame = useRef(0);
  const timer = useRef(0);

  const ref = useCallback((el) => setNode(el), []);

  useEffect(() => {
    if (!node || typeof ResizeObserver === 'undefined') return undefined;

    const apply = (width, height) => {
      if (width <= 0 || height <= 0) return;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };

    const measure = () => {
      const rect = node.getBoundingClientRect();
      apply(Math.round(rect.width), Math.round(rect.height));
    };

    const schedule = () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(timer.current);
      if (debounceMs > 0) {
        timer.current = setTimeout(() => { frame.current = requestAnimationFrame(measure); }, debounceMs);
      } else {
        frame.current = requestAnimationFrame(measure);
      }
    };

    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      clearTimeout(timer.current);
    };
  }, [node, debounceMs]);

  return [ref, size];
}
