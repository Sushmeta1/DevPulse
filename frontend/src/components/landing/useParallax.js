import { useEffect, useRef } from 'react';

/**
 * Decorative pointer parallax. Motion eases toward the pointer (a spring-like lerp), because tying
 * movement straight to the cursor feels mechanical. Transforms are written straight to each element
 * (never through a CSS variable on a parent, which would restyle every child) and the loop sleeps
 * as soon as everything has settled.
 *
 * Register layers with the returned `layer(depth)` / `tilt(maxDeg)` ref callbacks.
 */
export function useParallax(enabled) {
  const stage = useRef(null);
  const layers = useRef(new Set());

  useEffect(() => {
    if (!enabled) return undefined;
    let tx = 0; let ty = 0; let cx = 0; let cy = 0; let raf = 0;

    const apply = () => {
      layers.current.forEach(({ el, kind, amount }) => {
        el.style.transform = kind === 'tilt'
          ? `rotateX(${(-cy * amount).toFixed(3)}deg) rotateY(${(cx * amount * 1.25).toFixed(3)}deg)`
          : `translate3d(${(cx * amount).toFixed(2)}px, ${(cy * amount).toFixed(2)}px, 0)`;
      });
    };
    const loop = () => {
      cx += (tx - cx) * 0.075;
      cy += (ty - cy) * 0.075;
      apply();
      raf = Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(loop) : 0;
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(loop); };

    const onMove = (e) => {
      const box = stage.current?.getBoundingClientRect();
      if (!box || box.bottom < 0 || box.top > window.innerHeight) return; // off screen: do nothing
      tx = Math.max(-1.2, Math.min(1.2, ((e.clientX - box.left) / box.width - 0.5) * 2));
      ty = Math.max(-1.2, Math.min(1.2, ((e.clientY - box.top) / box.height - 0.5) * 2));
      wake();
    };
    const onLeave = () => { tx = 0; ty = 0; wake(); };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    const items = layers.current;
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
      items.forEach(({ el }) => { el.style.transform = ''; });
    };
  }, [enabled]);

  const register = (kind, amount) => (el) => {
    if (!el) return undefined;
    const entry = { el, kind, amount };
    layers.current.add(entry);
    return () => layers.current.delete(entry);
  };

  return { stage, layer: (depth) => register('layer', depth), tilt: (deg) => register('tilt', deg) };
}
