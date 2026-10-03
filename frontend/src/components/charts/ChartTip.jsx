import { cn } from '../../lib/cn.js';

/** Floating tip for hand-drawn charts. Positioned with transform only and clamped inside the card. */
export function ChartTip({ tip, className }) {
  if (!tip) return null;
  const flip = tip.x > tip.width * 0.62;
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-none absolute left-0 top-0 z-20 w-max max-w-56 rounded-lg bg-surface px-2.5 py-1.5 text-xs shadow-[var(--shadow-pop)]',
        className,
      )}
      style={{ transform: `translate(${flip ? tip.x - 12 : tip.x + 12}px, ${Math.max(0, tip.y - 8)}px) translateX(${flip ? '-100%' : '0'})` }}
    >
      {tip.content}
    </div>
  );
}
