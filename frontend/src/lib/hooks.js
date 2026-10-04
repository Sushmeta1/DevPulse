import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export function useMediaQuery(query) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

/** localStorage-backed state that never throws (private windows, blocked storage). */
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch { return initial; }
  });
  const set = (next) => {
    setValue(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  return [value, set];
}

const played = new Set();
/**
 * True only for the first mount of `key` in this page session. Entrance animations use it so they
 * celebrate the first paint but never replay while someone clicks between tabs all day.
 */
export function useFirstOnly(key) {
  const [first] = useState(() => !played.has(key));
  useEffect(() => { played.add(key); }, [key]);
  return first;
}

/** Tracks an element's width so charts can pick sensible tick counts on phones. */
export function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Pointer-following tooltip state for hand-drawn SVG/CSS charts. */
export function useHoverTip() {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  const show = (event, content) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: event.clientX - box.left, y: event.clientY - box.top, width: box.width, content });
  };
  return { ref, tip, show, hide: () => setTip(null) };
}

/** Keeps the browser tab title in step with what is on screen. */
export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} - DevPulse`;
    return () => { document.title = previous; };
  }, [title]);
}
