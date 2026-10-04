import { cn } from '../../lib/cn.js';

/** A calm browser chrome around product imagery. Purely decorative, so it is hidden from assistive tech. */
export function BrowserFrame({ url = 'devpulse.app/dashboard', className, children, bodyClassName }) {
  return (
    <div className={cn('overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-frame)]', className)}>
      <div className="flex h-9 items-center gap-3 border-b border-[var(--ring)] bg-surface-2 px-3" aria-hidden="true">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto flex h-5 w-full max-w-xs items-center justify-center rounded-md bg-surface text-[11px] text-fg-faint shadow-[inset_0_0_0_1px_var(--ring)]">{url}</span>
        <span className="w-12" />
      </div>
      <div className={cn('relative', bodyClassName)}>{children}</div>
    </div>
  );
}
