import { useMemo } from 'react';
import { Card, CardBody, CardHeader } from '../ui/Card.jsx';
import { ChartTip } from './ChartTip.jsx';
import { buildCalendar, levelScale } from '../../lib/chartData.js';
import { formatDay, formatDayLong, plural } from '../../lib/format.js';
import { useFirstOnly, useHoverTip } from '../../lib/hooks.js';

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const month = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });

export function Heatmap({ daily, values, noun = 'commit', title = 'Contribution calendar', description, motionKey = 'heatmap' }) {
  const rows = useMemo(() => daily.map((d, i) => ({ ...d, count: values[i] })), [daily, values]);
  const weeks = useMemo(() => buildCalendar(rows), [rows]);
  const level = useMemo(() => levelScale(values), [values]);
  const animate = useFirstOnly(motionKey);
  const { ref, tip, show, hide } = useHoverTip();
  const total = values.reduce((a, b) => a + b, 0);
  const activeDays = values.filter((v) => v > 0).length;
  const stats = useMemo(() => {
    let streak = 0;
    let run = 0;
    let best = { n: 0, date: null };
    values.forEach((v, i) => {
      run = v > 0 ? run + 1 : 0;
      streak = Math.max(streak, run);
      if (v > best.n) best = { n: v, date: daily[i].date };
    });
    return [
      ['Active days', `${activeDays} / ${values.length}`],
      ['Longest streak', plural(streak, 'day')],
      ['Busiest day', best.date ? `${formatDay(best.date)} · ${best.n}` : '-'],
    ];
  }, [values, daily, activeDays]);

  // Month label above the first week that starts a new month.
  const labels = weeks.map((w, i) => {
    const first = w.find(Boolean);
    const m = month.format(new Date(`${first.date}T00:00:00Z`));
    const prev = i > 0 ? month.format(new Date(`${weeks[i - 1].find(Boolean).date}T00:00:00Z`)) : null;
    return m !== prev ? m : '';
  });

  return (
    <Card className="h-full">
      <CardHeader title={title} description={description ?? `${plural(total, noun)} across ${plural(activeDays, 'active day')}`} />
      <CardBody>
        <div ref={ref} className="relative" onPointerLeave={hide}>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ '--cell': '22px' }}>
            <div className="grid shrink-0 grid-rows-[16px_repeat(7,var(--cell))] gap-[3px] text-[10px] leading-none text-fg-faint" aria-hidden="true">
              <span />
              {WEEKDAY_LABELS.map((l, i) => <span key={i} className="flex items-center">{l}</span>)}
            </div>
            <div
              role="grid"
              aria-label={`${plural(total, noun)} per day`}
              className="grid shrink-0 gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${weeks.length}, var(--cell))` }}
            >
              {weeks.map((w, wi) => (
                <div key={wi} role="row" className="grid grid-rows-[16px_repeat(7,var(--cell))] gap-[3px]">
                  <span className="truncate text-[10px] leading-4 text-fg-faint" aria-hidden="true">{labels[wi]}</span>
                  {Array.from({ length: 7 }, (_, di) => {
                    const cell = w[di];
                    if (!cell) return <span key={di} />;
                    const l = level(cell.count);
                    return (
                      <span
                        key={di}
                        role="gridcell"
                        aria-label={`${formatDayLong(cell.date)}: ${plural(cell.count, noun)}`}
                        className={`heat rounded-[4px] ${animate ? 'rise' : ''}`}
                        data-level={l}
                        style={{ '--i': animate ? wi * 0.4 : 0 }}
                        onPointerMove={(e) => show(e, (
                          <>
                            <p className="font-medium text-fg-muted">{formatDayLong(cell.date)}</p>
                            <p className="num font-semibold">{plural(cell.count, noun)}</p>
                          </>
                        ))}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <ChartTip tip={tip} />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--ring)] pt-4">
          {stats.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="truncate text-xs text-fg-muted">{k}</dt>
              <dd className="num truncate text-[13px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-fg-faint" aria-hidden="true">
          Less
          {[0, 1, 2, 3, 4].map((l) => <span key={l} className="heat h-2.5 w-2.5 rounded-[3px]" data-level={l} />)}
          More
        </div>
      </CardBody>
    </Card>
  );
}
