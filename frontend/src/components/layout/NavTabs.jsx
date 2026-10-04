import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/cn.js';

/**
 * Route tabs with a sliding underline. The indicator is one element moved with transform only
 * (translate + scaleX), eased in-out because it travels across the screen.
 */
export function NavTabs({ items }) {
  const { pathname, search } = useLocation();
  const list = useRef(null);
  const [bar, setBar] = useState({ x: 0, w: 0, ready: false });

  const activeIndex = items.findIndex((it) => (it.end ? pathname === it.to || pathname === `${it.to}/` : pathname.startsWith(it.to)));

  useLayoutEffect(() => {
    const measure = () => {
      const el = list.current?.children[activeIndex];
      if (!el) return;
      setBar((b) => ({ x: el.offsetLeft, w: el.offsetWidth, ready: b.ready }));
    };
    measure();
    // Fonts load after first paint and change tab widths; measure again once they are in.
    document.fonts?.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(list.current);
    const raf = requestAnimationFrame(() => setBar((b) => ({ ...b, ready: true })));
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [activeIndex]);

  return (
    <nav aria-label="Dashboard sections" className="scroll-x -mb-px">
      <div ref={list} className="relative flex w-max min-w-full gap-1">
        {items.map((it) => (
          <NavLink
            key={it.to} to={{ pathname: it.to, search }} end={it.end}
            className={({ isActive }) => cn(
              'press relative inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors duration-150',
              isActive ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {it.label}
            {it.count !== undefined && <span className="num rounded-full bg-surface-2 px-1.5 text-[11px] text-fg-muted">{it.count}</span>}
          </NavLink>
        ))}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left rounded-full bg-fg"
          style={{
            transform: `translateX(${bar.x + 12}px) scaleX(${Math.max(0, bar.w - 24)})`,
            transition: bar.ready ? 'transform 250ms var(--ease-in-out)' : 'none',
            opacity: activeIndex < 0 ? 0 : 1,
          }}
        />
      </div>
    </nav>
  );
}
