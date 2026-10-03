import { useEffect, useRef, useState } from 'react';

/**
 * True once the element has scrolled into view (and stays true - reveals play once, because an
 * interface that re-animates every time you scroll past it is fighting its reader).
 */
export function useInView({ rootMargin = '0px 0px -10% 0px', threshold = 0.1 } = {}) {
  const ref = useRef(null);
  // Without IntersectionObserver there is nothing to wait for: show the content.
  const [inView, setInView] = useState(typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect(); }
    }, { rootMargin, threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, threshold]);

  return [ref, inView];
}
