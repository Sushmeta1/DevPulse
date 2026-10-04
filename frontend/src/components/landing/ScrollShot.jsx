import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn.js';

/**
 * Shows a tall full-page screenshot inside a fixed-height frame and slowly scrolls it, so a visitor sees the
 * whole page without touching anything. Pauses on hover/focus (so they can read) and under reduced motion.
 * The movement is one `transform: translateY` on the image, run by a CSS animation off the main thread.
 */
export function ScrollShot({ src, alt, className, priority = false, running = true, zoom = 1 }) {
  const frame = useRef(null);
  const img = useRef(null);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const measure = () => {
      if (!frame.current || !img.current?.naturalHeight) return;
      const overflow = img.current.clientHeight - frame.current.clientHeight;
      if (overflow <= 4) { setMetrics({ shift: 0, seconds: 0 }); return; }
      setMetrics({ shift: -(overflow / img.current.clientHeight) * 100, seconds: Math.max(7, overflow / 55) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame.current);
    const node = img.current;
    node.addEventListener('load', measure);
    return () => { ro.disconnect(); node.removeEventListener('load', measure); };
  }, [src, zoom]);

  return (
    <div ref={frame} className={cn('scroll-frame relative overflow-hidden', className)}>
      <img
        ref={img} key={src} src={src} alt={alt} decoding="async"
        loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'}
        className="scroll-shot block max-w-none select-none"
        data-run={running && Boolean(metrics?.shift)}
        style={{ width: `${zoom * 100}%`, ...(metrics ? { '--shift': `${metrics.shift}%`, '--dur': `${metrics.seconds}s` } : {}) }}
        draggable={false}
      />
    </div>
  );
}
