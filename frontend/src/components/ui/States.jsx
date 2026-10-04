import { AlertTriangle } from 'lucide-react';
import { Button } from './Button.jsx';
import { cn } from '../../lib/cn.js';

export function EmptyState({ icon: Icon, title, children, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      {Icon && (
        <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-fg-faint shadow-[inset_0_0_0_1px_var(--ring)]">
          <Icon size={18} aria-hidden="true" />
        </span>
      )}
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-[13px] text-fg-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-red-soft text-red"><AlertTriangle size={18} aria-hidden="true" /></span>
      <p className="text-sm font-medium">Something went wrong</p>
      <p className="mt-1 max-w-md text-[13px] text-fg-muted">{error?.message || 'Unexpected error.'}</p>
      {onRetry && <Button className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
