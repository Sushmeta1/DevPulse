import { cn } from '../../lib/cn.js';

const TONES = {
  neutral: 'bg-surface-2 text-fg-muted',
  green: 'bg-green-soft text-green',
  amber: 'bg-amber-soft text-amber',
  red: 'bg-red-soft text-red',
  violet: 'bg-violet-soft text-violet',
  accent: 'bg-accent-soft text-accent',
};

export function Badge({ tone = 'neutral', dot = false, className, children }) {
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium', TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
