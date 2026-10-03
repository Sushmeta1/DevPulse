import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { compare, formatPercent } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

/**
 * Change versus the previous period. `goodWhen` says which direction is good, because for lead time
 * "down" is the win. Renders nothing when there is nothing honest to compare against.
 */
export function Delta({ current, previous, goodWhen = 'up', className }) {
  const { kind, pct } = compare(current, previous);
  if (kind === 'none' || (kind === 'flat' && current === 0)) return null; // 0 -> 0 is not news

  let tone = 'text-fg-muted bg-surface-2';
  let Icon = Minus;
  let text = 'No change';
  if (kind === 'new') { text = 'New'; tone = 'text-accent bg-accent-soft'; Icon = ArrowUpRight; }
  if (kind === 'up' || kind === 'down') {
    const good = kind === goodWhen;
    tone = good ? 'text-green bg-green-soft' : 'text-red bg-red-soft';
    Icon = kind === 'up' ? ArrowUpRight : ArrowDownRight;
    text = formatPercent(pct);
  }
  return (
    <span className={cn('num inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 text-xs font-medium', tone, className)}>
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      {text}
      <span className="sr-only"> versus the previous period</span>
    </span>
  );
}
