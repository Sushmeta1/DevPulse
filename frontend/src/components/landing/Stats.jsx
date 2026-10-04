import { useInView } from '../../lib/useInView.js';
import { Number } from '../ui/Number.jsx';

const STATS = [
  [180, 'days of history synced per repository'],
  [7, 'interactive chart types'],
  [5, 'plain-English health signals'],
  [0, 'lines of your source code read'],
];

/** Digits roll up from zero the first time the strip scrolls into view. */
export function Stats() {
  const [ref, inView] = useInView({ threshold: 0.4 });
  return (
    <section ref={ref} aria-label="DevPulse in numbers" className="mx-auto max-w-[1120px] px-5 py-14 sm:px-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
        {STATS.map(([value, label], i) => (
          <div key={label} className="reveal" data-reveal="up" data-in={inView} style={{ '--d': `${i * 90}ms` }}>
            <dd className="num text-5xl font-semibold tracking-tight sm:text-6xl"><Number value={inView ? value : value === 0 ? 0 : 1} /></dd>
            <dt className="mt-2 max-w-[16ch] text-[13px] leading-snug text-fg-muted">{label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
