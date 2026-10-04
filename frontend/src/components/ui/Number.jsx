import NumberFlow from '@number-flow/react';

// Digits roll when the value changes (state indication). Timings follow the <300ms UI budget.
const TIMING = { duration: 360, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };

/**
 * The rolling digits are purely visual, so they are hidden from assistive tech and the settled value is
 * provided as plain text instead - a screen reader should hear "1,284", not a reel of 0-9 per column.
 */
export function Number({ value, format, suffix, className }) {
  const text = `${new Intl.NumberFormat(undefined, format).format(value)}${suffix ?? ''}`;
  return (
    <>
      <span className="sr-only">{text}</span>
      <NumberFlow
        aria-hidden="true"
        value={value}
        format={format}
        suffix={suffix}
        className={className}
        transformTiming={TIMING}
        spinTiming={TIMING}
        opacityTiming={{ duration: 180, easing: 'ease-out' }}
      />
    </>
  );
}
