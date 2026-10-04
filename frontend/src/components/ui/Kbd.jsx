import { cn } from '../../lib/cn.js';

export const Kbd = ({ children, className }) => (
  <kbd className={cn('mono inline-grid h-5 min-w-5 place-items-center rounded bg-surface-2 px-1 text-[11px] text-fg-muted shadow-[0_0_0_1px_var(--ring)]', className)}>
    {children}
  </kbd>
);
