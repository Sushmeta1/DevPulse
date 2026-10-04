import { useState } from 'react';
import { Sparkline } from '../charts/Sparkline.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Delta } from '../ui/Delta.jsx';
import { Number } from '../ui/Number.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { formatDayLong, formatHours, plural } from '../../lib/format.js';
import { useFirstOnly } from '../../lib/hooks.js';

function Kpi({ label, children, className, index, first }) {
  return (
    <div className={`card flex min-w-0 flex-col p-4 sm:p-5 ${first ? 'rise' : ''} ${className ?? ''}`} style={{ '--i': index }}>
      <p className="text-[13px] font-medium text-fg-muted">{label}</p>
      {children}
    </div>
  );
}

function SparkKpi({ label, value, previous, values, dates, color, hint, index, first, noun }) {
  const [hover, setHover] = useState(null);
  const shown = hover === null ? value : values[hover];
  return (
    <Kpi label={label} index={index} first={first}>
      <div className="mt-1.5 flex items-baseline gap-2.5">
        <Number value={shown} className="num text-[28px] font-semibold leading-none tracking-tight" />
        {hover === null && <Delta current={value} previous={previous} />}
      </div>
      <p className="num mt-1.5 h-4 truncate text-xs text-fg-muted">
        {hover === null ? hint : `${formatDayLong(dates[hover])} - ${plural(values[hover], noun)}`}
      </p>
      <div className="mt-3 h-10">
        <Sparkline values={values} color={color} onHover={setHover} activeIndex={hover} animate={first} label={`${label} per day`} />
      </div>
    </Kpi>
  );
}

export function KpiGrid({ summary }) {
  const first = useFirstOnly('kpis');
  const { totals: t, previous, daily, topContributors, leadTime, reviews: rv } = summary;
  const dates = daily.map((d) => d.date);
  const leadTotal = leadTime.reduce((n, b) => n + b.count, 0);
  const leadMax = Math.max(1, ...leadTime.map((b) => b.count));
  const reviewDist = rv.available ? rv.firstReview.distribution : [];
  const reviewTotal = reviewDist.reduce((n, b) => n + b.count, 0);
  const reviewMax = Math.max(1, ...reviewDist.map((b) => b.count));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SparkKpi
        label="Commits" value={t.commits} previous={previous?.commits} values={daily.map((d) => d.commits)} dates={dates}
        color="var(--accent)" noun="commit" index={0} first={first}
        hint={`${plural(t.activeDays, 'active day')} of ${summary.range.days}`}
      />
      <SparkKpi
        label="Pull requests" value={t.pullRequests} previous={previous?.pullRequests} values={daily.map((d) => d.opened)} dates={dates}
        color="var(--green)" noun="PR opened" index={1} first={first}
        hint={`${t.mergedPullRequests} merged · ${t.openPullRequests} open now`}
      />
      {rv.available ? (
        <Kpi label="Median time to first review" index={2} first={first}>
          <div className="mt-1.5 flex items-baseline gap-2.5">
            <span className="num text-[28px] font-semibold leading-none tracking-tight">{formatHours(rv.firstReview.medianHours)}</span>
            <Delta current={rv.firstReview.medianHours} previous={rv.previousMedianHours} goodWhen="down" />
          </div>
          <p className="mt-1.5 truncate text-xs text-fg-muted">
            {rv.firstReview.reviewedCount === 0 ? 'No reviewed pull requests' : `${rv.firstReview.withinDayPct}% reviewed within a day`}
            {rv.waitingCount > 0 && ` · ${rv.waitingCount} waiting`}
          </p>
          <div className="mt-3 flex h-10 items-end gap-1" aria-hidden="true">
            {rv.firstReview.distribution.map((b) => (
              <span
                key={b.label}
                className="flex-1 rounded-sm bg-amber"
                style={{ height: `${reviewTotal ? Math.max(8, (b.count / reviewMax) * 100) : 8}%`, opacity: reviewTotal ? 0.25 + 0.75 * (b.count / reviewMax) : 0.15 }}
              />
            ))}
          </div>
        </Kpi>
      ) : (
        <Kpi label="Contributors" index={2} first={first}>
          <div className="mt-1.5 flex items-baseline gap-2.5">
            <Number value={t.contributors} className="num text-[28px] font-semibold leading-none tracking-tight" />
            <Delta current={t.contributors} previous={previous?.contributors} />
          </div>
          <p className="mt-1.5 truncate text-xs text-fg-muted">
            {t.longestStreak > 1 ? `Longest streak: ${plural(t.longestStreak, 'day')}` : 'People who committed or opened a PR'}
          </p>
          <div className="mt-3 flex h-10 items-center">
            {topContributors.length === 0 ? (
              <span className="text-xs text-fg-faint">No one yet</span>
            ) : (
              <div className="flex -space-x-2">
                {topContributors.slice(0, 6).map((p) => (
                  <span key={p.login} className="rounded-full ring-2 ring-[var(--surface)]" title={p.name || p.login}>
                    <Avatar login={p.linked ? p.login : null} name={p.name || p.login} size={28} />
                  </span>
                ))}
                {t.contributors > 6 && (
                  <span className="num grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-[11px] font-medium text-fg-muted ring-2 ring-[var(--surface)]">
                    +{t.contributors - 6}
                  </span>
                )}
              </div>
            )}
          </div>
        </Kpi>
      )}
      <Kpi label="Median time to merge" index={3} first={first}>
        <div className="mt-1.5 flex items-baseline gap-2.5">
          <span className="num text-[28px] font-semibold leading-none tracking-tight">{formatHours(t.medianMergeHours)}</span>
          <Delta current={t.medianMergeHours} previous={previous?.medianMergeHours} goodWhen="down" />
        </div>
        <p className="mt-1.5 truncate text-xs text-fg-muted">
          {t.p90MergeHours === null ? 'No merged pull requests' : `Slowest 10%: ${formatHours(t.p90MergeHours)}`}
        </p>
        <div className="mt-3 flex h-10 items-end gap-1" aria-hidden="true">
          {leadTime.map((b) => (
            <span
              key={b.label}
              className="flex-1 rounded-sm bg-violet"
              style={{ height: `${leadTotal ? Math.max(8, (b.count / leadMax) * 100) : 8}%`, opacity: leadTotal ? 0.25 + 0.75 * (b.count / leadMax) : 0.15 }}
            />
          ))}
        </div>
      </Kpi>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="card p-4 sm:p-5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-2.5 h-3 w-36" />
          <Skeleton className="mt-4 h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
