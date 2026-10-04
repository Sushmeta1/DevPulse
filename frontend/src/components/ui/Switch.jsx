import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { cn } from '../../lib/cn.js';

export function Switch({ checked, onCheckedChange, label, disabled, id }) {
  return (
    <label className={cn('inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-fg-muted', disabled && 'cursor-not-allowed opacity-50')}>
      <BaseSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="press relative h-5 w-9 rounded-full bg-surface-3 shadow-[inset_0_0_0_1px_var(--ring)] transition-colors duration-200 data-[checked]:bg-accent"
      >
        <BaseSwitch.Thumb className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-out)] data-[checked]:translate-x-4" />
      </BaseSwitch.Root>
      {label}
    </label>
  );
}
