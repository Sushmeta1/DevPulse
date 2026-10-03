import { cn } from '../../lib/cn.js';
import { Spinner } from './Spinner.jsx';

const VARIANTS = {
  primary: 'bg-fg text-bg hover:opacity-85',
  secondary: 'bg-surface text-fg shadow-[0_0_0_1px_var(--ring)] hover:bg-surface-2',
  ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
  accent: 'bg-accent text-[var(--accent-fg)] hover:opacity-90',
};
const SIZES = {
  sm: 'h-7 gap-1.5 rounded-md px-2.5 text-[13px]',
  md: 'h-8 gap-2 rounded-lg px-3 text-[13px]',
  lg: 'h-10 gap-2 rounded-lg px-4 text-sm',
  icon: 'h-8 w-8 rounded-lg',
};

export function Button({ variant = 'secondary', size = 'md', loading = false, icon: Icon, className, children, disabled, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'press inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : Icon ? <Icon size={15} strokeWidth={2} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
