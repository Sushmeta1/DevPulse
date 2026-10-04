import { Tabs } from '@base-ui/react/tabs';
import { cn } from '../../lib/cn.js';

/**
 * Pill-style segmented control. The indicator slides with a transform (ease-in-out: it is moving on
 * screen, not entering), and Base UI handles roving focus + arrow keys.
 */
export function Segmented({ value, onChange, options, label, size = 'md', className }) {
  return (
    <Tabs.Root value={String(value)} onValueChange={(v) => onChange(options.find((o) => String(o.value) === v).value)}>
      <Tabs.List
        aria-label={label}
        className={cn('relative inline-flex rounded-lg bg-surface-2 p-0.5 shadow-[inset_0_0_0_1px_var(--ring)]', className)}
      >
        {options.map((o) => (
          <Tabs.Tab
            key={o.value}
            value={String(o.value)}
            disabled={o.disabled}
            className={cn(
              'press relative z-10 select-none rounded-md px-2.5 font-medium text-fg-muted transition-colors duration-150',
              'data-[active]:text-fg disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm' ? 'h-6 text-xs' : 'h-7 text-[13px]',
            )}
          >
            {o.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator
          className="absolute left-0 top-0.5 z-0 h-[calc(100%-4px)] w-(--active-tab-width) translate-x-(--active-tab-left) rounded-md bg-surface shadow-[0_0_0_1px_var(--ring),0_1px_2px_rgb(0_0_0/0.08)] transition-[translate,width] duration-250 ease-[var(--ease-in-out)]"
        />
      </Tabs.List>
    </Tabs.Root>
  );
}
