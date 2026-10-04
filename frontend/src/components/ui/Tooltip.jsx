import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';

// One provider: after the first tooltip opens, its neighbours open instantly (no delay, no animation).
export const TooltipProvider = ({ children }) => (
  <BaseTooltip.Provider delay={350} closeDelay={0} timeout={400}>{children}</BaseTooltip.Provider>
);

export function Tooltip({ content, children, side = 'top' }) {
  if (!content) return children;
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={8} className="z-50">
          <BaseTooltip.Popup className="tooltip-popup max-w-64 rounded-md bg-fg px-2 py-1 text-xs font-medium text-bg shadow-lg">
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
