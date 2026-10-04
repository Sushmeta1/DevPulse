import { formatDay } from './format.js';

export const METRICS = {
  commits: { label: 'Commits', noun: 'commit', color: 'var(--accent)' },
  opened: { label: 'PRs opened', noun: 'PR opened', color: 'var(--green)' },
  merged: { label: 'PRs merged', noun: 'PR merged', color: 'var(--violet)' },
};

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

/**
 * Turns the API summary into chart rows.
 *  metric: 'commits' | 'opened' | 'merged'
 *  who: optional contributor login (filters commits only)
 *  weekly: bucket seven days together (anchored to the most recent day, so the latest bucket is always full)
 */
export function buildSeries({ summary, metric = 'commits', who = null, weekly = false, compare = false }) {
  const days = summary.daily;
  const person = who ? summary.topContributors.find((p) => p.login === who) : null;
  const values = days.map((d, i) => (metric === 'commits' && person ? person.series[i] : d[metric]));
  const prevValues = compare && metric === 'commits' && !person && summary.previousCommitsDaily ? summary.previousCommitsDaily : null;

  const size = weekly ? 7 : 1;
  const rows = [];
  for (let end = days.length; end > 0; end -= size) {
    const from = Math.max(0, end - size);
    const slice = values.slice(from, end);
    const first = days[from].date;
    const last = days[end - 1].date;
    const top = !weekly && metric === 'commits'
      ? summary.topContributors
          .map((p) => ({ login: p.login, n: p.series[from] }))
          .filter((p) => p.n > 0)
          .sort((a, b) => b.n - a.n)
          .slice(0, 3)
      : [];
    rows.unshift({
      key: first,
      date: first,
      label: weekly && first !== last ? `${formatDay(first)} - ${formatDay(last)}` : formatDay(first),
      value: sum(slice),
      prev: prevValues ? sum(prevValues.slice(from, end)) : null,
      top,
    });
  }
  const total = sum(rows.map((r) => r.value));
  const peak = rows.reduce((m, r) => (r.value > m.value ? r : m), rows[0] || { value: 0 });
  return {
    rows,
    total,
    average: rows.length ? total / rows.length : 0,
    peak: peak?.value ? peak : null,
    prevTotal: prevValues ? sum(prevValues) : null,
  };
}

/** Calendar layout for the contribution heatmap: columns are weeks, rows are weekdays (Sun..Sat). */
export function buildCalendar(daily) {
  const firstWeekday = new Date(`${daily[0].date}T00:00:00Z`).getUTCDay();
  const cells = [...Array.from({ length: firstWeekday }, () => null), ...daily];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Bucket 0-4 using quartiles of the non-zero days, so a quiet repo still shows contrast. */
export function levelScale(values) {
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!nz.length) return () => 0;
  const q = (p) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))];
  const [a, b, c] = [q(0.25), q(0.5), q(0.75)];
  return (v) => (v <= 0 ? 0 : v <= a ? 1 : v <= b ? 2 : v <= c ? 3 : 4);
}
