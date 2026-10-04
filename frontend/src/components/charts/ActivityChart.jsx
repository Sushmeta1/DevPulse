import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { X } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/Card.jsx';
import { Segmented } from '../ui/Segmented.jsx';
import { Switch } from '../ui/Switch.jsx';
import { Delta } from '../ui/Delta.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Number } from '../ui/Number.jsx';
import { EmptyState } from '../ui/States.jsx';
import { METRICS, buildSeries } from '../../lib/chartData.js';
import { formatCompact, formatDay, formatDayLong, formatNumber, plural } from '../../lib/format.js';
import { useFirstOnly } from '../../lib/hooks.js';
import { Activity } from 'lucide-react';

function TipCard({ active, payload, metric, compareOn }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const m = METRICS[metric];
  return (
    <div className="min-w-44 rounded-lg bg-surface px-3 py-2.5 text-xs shadow-[var(--shadow-pop)]">
      <p className="font-medium text-fg-muted">{row.label.includes(' - ') ? row.label : formatDayLong(row.date)}</p>
      <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
        <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
        <span className="num">{plural(row.value, m.noun)}</span>
      </p>
      {compareOn && row.prev !== null && (
        <p className="num mt-1 flex items-center gap-2 text-fg-muted">
          <span className="h-0.5 w-2 rounded bg-[var(--prev)]" /> {formatNumber(row.prev)} previous period
        </p>
      )}
      {row.top.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-[var(--ring)] pt-2">
          {row.top.map((p) => (
            <li key={p.login} className="flex items-center gap-2">
              <Avatar login={p.login} size={16} />
              <span className="min-w-0 flex-1 truncate">{p.login}</span>
              <span className="num text-fg-muted">{p.n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ActivityChart({ summary, who, onClearWho }) {
  const [metric, setMetric] = useState('commits');
  const [weekly, setWeekly] = useState(false);
  const [compareOn, setCompareOn] = useState(true);
  const reveal = useFirstOnly('activity-chart');

  const days = summary.range.days;
  const canCompare = metric === 'commits' && !who && Boolean(summary.previousCommitsDaily);
  const isWeekly = weekly && days >= 30;
  const series = useMemo(
    () => buildSeries({ summary, metric, who, weekly: isWeekly, compare: compareOn && canCompare }),
    [summary, metric, who, isWeekly, compareOn, canCompare],
  );
  const m = METRICS[metric];
  const showPrev = compareOn && canCompare;
  const empty = series.total === 0;
  const prevTotal = metric === 'commits' ? summary.previous?.commits : metric === 'opened' ? summary.previous?.pullRequests : summary.previous?.mergedPullRequests;
  const gradId = `grad-${metric}`;

  const label = `${m.label} per ${isWeekly ? 'week' : 'day'} over the last ${days} days: ${series.total} total${
    series.peak ? `, peak ${series.peak.value} on ${formatDay(series.peak.date)}` : ''}.`;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Activity"
        description={who ? undefined : `${m.label} over the last ${days} days`}
        actions={(
          <Segmented
            label="Metric" size="sm" value={metric} onChange={setMetric}
            options={Object.entries(METRICS).map(([value, { label: l }]) => ({ value, label: l }))}
          />
        )}
      />
      <CardBody className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <div className="flex items-baseline gap-3">
              <Number value={series.total} className="num text-3xl font-semibold tracking-tight" />
              {!who && <Delta current={series.total} previous={prevTotal} />}
            </div>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              <span className="num">{series.average.toFixed(series.average < 10 ? 1 : 0)}</span> per {isWeekly ? 'week' : 'day'} on average
              {series.peak && <> · peak <span className="num font-medium text-fg">{series.peak.value}</span> on {formatDay(series.peak.date)}</>}
            </p>
            {who && (
              <button
                onClick={onClearWho}
                className="press mt-2 inline-flex h-6 items-center gap-1.5 rounded-full bg-accent-soft pl-1 pr-2 text-xs font-medium text-accent"
                aria-label={`Clear filter: ${who}`}
              >
                <Avatar login={who} size={16} /> {who} <X size={12} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canCompare && <Switch checked={compareOn} onCheckedChange={setCompareOn} label="Compare" />}
            {days >= 30 && (
              <Segmented
                label="Granularity" size="sm" value={isWeekly ? 'week' : 'day'} onChange={(v) => setWeekly(v === 'week')}
                options={[{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }]}
              />
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-1 flex-col">
          {empty ? (
            <EmptyState icon={Activity} title={`No ${m.label.toLowerCase()} in this period`} className="min-h-60 flex-1">
              Try a longer range, or pick another repository.
            </EmptyState>
          ) : (
            <div role="img" aria-label={label} className={`min-h-[260px] flex-1 ${reveal ? 'reveal-x' : ''}`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series.rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={m.color} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--ring)" strokeDasharray="3 4" />
                  <XAxis
                    dataKey="date" tickFormatter={formatDay} tickLine={false} axisLine={{ stroke: 'var(--ring)' }}
                    tick={{ fontSize: 11, fill: 'var(--fg-faint)' }} minTickGap={28} interval="preserveStartEnd" tickMargin={8}
                  />
                  <YAxis
                    allowDecimals={false} tickLine={false} axisLine={false} width={36} tickFormatter={formatCompact}
                    tick={{ fontSize: 11, fill: 'var(--fg-faint)' }} domain={[0, (max) => Math.max(3, Math.ceil(max * 1.15))]}
                  />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ stroke: 'var(--ring-strong)', strokeDasharray: '3 3' }}
                    content={<TipCard metric={metric} compareOn={showPrev} />}
                    allowEscapeViewBox={{ x: false, y: true }}
                  />
                  {series.average > 0 && series.rows.length > 2 && (
                    <ReferenceLine y={series.average} stroke="var(--fg-faint)" strokeDasharray="2 4" strokeOpacity={0.7} />
                  )}
                  {showPrev && (
                    <Area
                      type="monotone" dataKey="prev" stroke="var(--prev)" strokeWidth={1.5} strokeDasharray="4 4"
                      fill="none" dot={false} activeDot={false} isAnimationActive={false}
                    />
                  )}
                  <Area
                    type="monotone" dataKey="value" stroke={m.color} strokeWidth={2} fill={`url(#${gradId})`}
                    dot={false} isAnimationActive={false}
                    activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2, fill: m.color }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
