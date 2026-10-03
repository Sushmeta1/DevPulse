import { useMemo } from 'react';
import { Card, CardBody, CardHeader } from '../ui/Card.jsx';
import { ChartTip } from './ChartTip.jsx';
import { plural } from '../../lib/format.js';
import { useFirstOnly, useHoverTip } from '../../lib/hooks.js';

// Monday first, like a working week.
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`;

const LEFT = 34;
const TOP = 6;
const CELL = 28;
const W = LEFT + 24 * CELL;
const H = TOP + 7 * CELL + 22;

export function Punchcard({ matrix }) {
  const { ref, tip, show, hide } = useHoverTip();
  const animate = useFirstOnly('punchcard');
  const { max, peak, total } = useMemo(() => {
    let best = { n: 0, wd: 0, h: 0 };
    let sum = 0;
    matrix.forEach((row, wd) => row.forEach((n, h) => { sum += n; if (n > best.n) best = { n, wd, h }; }));
    return { max: best.n, peak: best.n ? best : null, total: sum };
  }, [matrix]);

  return (
    <Card className="h-full">
      <CardHeader
        title="When work happens"
        description={peak ? `Busiest: ${NAMES[peak.wd]}s around ${hourLabel(peak.h)} (${plural(peak.n, 'commit')})` : 'Commits by weekday and hour, in your time zone'}
      />
      <CardBody>
        {total === 0 ? (
          <p className="py-10 text-center text-[13px] text-fg-muted">No commits to chart in this period.</p>
        ) : (
          <div ref={ref} className="relative" onPointerLeave={hide}>
            <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Commit activity by weekday and hour. Busiest: ${NAMES[peak.wd]} at ${hourLabel(peak.h)}.`}>
              {ORDER.map((wd, row) => (
                <text key={wd} x={LEFT - 8} y={TOP + row * CELL + CELL / 2 + 3.5} textAnchor="end" fontSize="10.5" fill="var(--fg-faint)">{SHORT[wd]}</text>
              ))}
              {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                <text key={h} x={LEFT + h * CELL + CELL / 2} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--fg-faint)">{String(h).padStart(2, '0')}</text>
              ))}
              {ORDER.map((wd, row) => matrix[wd].map((n, h) => {
                const cx = LEFT + h * CELL + CELL / 2;
                const cy = TOP + row * CELL + CELL / 2;
                const r = n === 0 ? 1.6 : 2.5 + Math.sqrt(n / max) * 10;
                const isPeak = peak && peak.wd === wd && peak.h === h;
                return (
                  <g key={`${wd}-${h}`}>
                    <circle
                      cx={cx} cy={cy} r={r}
                      fill={n === 0 ? 'var(--fg-faint)' : 'var(--accent)'}
                      fillOpacity={n === 0 ? 0.35 : 0.25 + 0.75 * (n / max)}
                      stroke={isPeak ? 'var(--fg)' : 'none'} strokeWidth={1.5}
                      className={animate && n > 0 ? 'fade-in' : undefined}
                      style={animate && n > 0 ? { animationDelay: `${h * 12}ms` } : undefined}
                    />
                    <rect
                      x={cx - CELL / 2} y={cy - CELL / 2} width={CELL} height={CELL} fill="transparent"
                      onPointerMove={(e) => show(e, (
                        <>
                          <p className="font-medium text-fg-muted">{NAMES[wd]}, {hourLabel(h)}-{hourLabel((h + 1) % 24)}</p>
                          <p className="num font-semibold">{plural(n, 'commit')}</p>
                        </>
                      ))}
                    />
                  </g>
                );
              }))}
            </svg>
            <ChartTip tip={tip} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
