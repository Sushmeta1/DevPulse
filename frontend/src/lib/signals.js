import { formatHours, formatNumber } from './format.js';

/**
 * Plain-English health signals derived from the analytics summary - no AI involved.
 * status: 'good' | 'warn' | 'bad' | 'neutral'
 */
export function deriveSignals(summary) {
  const t = summary.totals;
  const days = summary.range.days;
  const out = [];

  // Review speed
  if (t.medianMergeHours === null) {
    out.push({ id: 'review', label: 'Review speed', value: '-', status: 'neutral', detail: 'No pull requests were merged in this period.' });
  } else {
    const h = t.medianMergeHours;
    out.push({
      id: 'review', label: 'Review speed', value: formatHours(h),
      status: h <= 24 ? 'good' : h <= 72 ? 'warn' : 'bad',
      detail: `Median time from open to merge. The slowest 10% took ${formatHours(t.p90MergeHours)} or more.`,
    });
  }

  // Stale PRs
  out.push({
    id: 'stale', label: 'Stale pull requests', value: formatNumber(t.stalePullRequests),
    status: t.stalePullRequests === 0 ? 'good' : t.stalePullRequests <= 2 ? 'warn' : 'bad',
    detail: t.stalePullRequests === 0
      ? `Nothing has been open for more than 14 days (${formatNumber(t.openPullRequests)} open now).`
      : `Open for more than 14 days. The oldest has waited ${formatNumber(t.oldestOpenDays)} days.`,
  });

  // Bus factor: how concentrated the commits are
  const people = summary.topContributors;
  if (t.commits === 0) {
    out.push({ id: 'spread', label: 'Knowledge spread', value: '-', status: 'neutral', detail: 'No commits in this period.' });
  } else if (t.contributors <= 1) {
    out.push({ id: 'spread', label: 'Knowledge spread', value: '1 person', status: 'warn', detail: 'A single contributor wrote everything in this period.' });
  } else {
    const share = Math.round((people[0].commits / t.commits) * 100);
    out.push({
      id: 'spread', label: 'Knowledge spread', value: `${share}% top author`,
      status: share <= 50 ? 'good' : share <= 75 ? 'warn' : 'bad',
      detail: `${people[0].login} wrote ${share}% of commits across ${formatNumber(t.contributors)} contributors.`,
    });
  }

  // Work rhythm: late-night and weekend share of commits, in the viewer's time zone
  const total = summary.punchcard.flat().reduce((a, b) => a + b, 0);
  if (total > 0) {
    let off = 0;
    summary.punchcard.forEach((row, wd) => row.forEach((n, h) => {
      if (wd === 0 || wd === 6 || h >= 22 || h < 6) off += n;
    }));
    const share = Math.round((off / total) * 100);
    out.push({
      id: 'rhythm', label: 'Work rhythm', value: `${share}% off-hours`,
      status: share < 15 ? 'good' : share < 30 ? 'warn' : 'bad',
      detail: 'Share of commits made on weekends or between 22:00 and 06:00 local time.',
    });
  }

  // Momentum vs previous period
  if (summary.previous && summary.previous.commits > 0) {
    const pct = Math.round(((t.commits - summary.previous.commits) / summary.previous.commits) * 100);
    out.push({
      id: 'momentum', label: 'Momentum', value: `${pct > 0 ? '+' : ''}${pct}%`,
      status: pct >= -10 ? 'good' : pct >= -35 ? 'warn' : 'bad',
      detail: `${formatNumber(t.commits)} commits versus ${formatNumber(summary.previous.commits)} in the previous ${days} days.`,
    });
  }
  return out;
}
