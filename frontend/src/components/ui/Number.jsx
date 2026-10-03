import NumberFlow from '@number-flow/react';

// Digits roll when the value changes (state indication). Timings follow the <300ms UI budget.
const TIMING = { duration: 360, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };

export function Number({ value, format, suffix, className }) {
  return (
    <NumberFlow
      value={value}
      format={format}
      suffix={suffix}
      className={className}
      transformTiming={TIMING}
      spinTiming={TIMING}
      opacityTiming={{ duration: 180, easing: 'ease-out' }}
    />
  );
}
