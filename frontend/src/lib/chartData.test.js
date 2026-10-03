import { describe, expect, it } from 'vitest';
import { buildCalendar, buildSeries, levelScale } from './chartData.js';

const daily = Array.from({ length: 10 }, (_, i) => ({
  date: `2025-03-${String(i + 1).padStart(2, '0')}`, commits: i, opened: 1, merged: i % 2,
}));
const summary = {
  daily,
  previousCommitsDaily: Array.from({ length: 10 }, () => 2),
  topContributors: [
    { login: 'ann', series: daily.map((d) => d.commits) },
    { login: 'bob', series: daily.map((d) => (d.commits > 5 ? 1 : 0)) },
  ],
};

describe('buildSeries', () => {
  it('daily commits with totals, average and peak', () => {
    const s = buildSeries({ summary });
    expect(s.rows).toHaveLength(10);
    expect(s.total).toBe(45);
    expect(s.average).toBe(4.5);
    expect(s.peak.date).toBe('2025-03-10');
    expect(s.prevTotal).toBeNull();
    expect(s.rows[9].top[0]).toEqual({ login: 'ann', n: 9 });
  });

  it('compares with the previous period', () => {
    const s = buildSeries({ summary, compare: true });
    expect(s.prevTotal).toBe(20);
    expect(s.rows[0].prev).toBe(2);
  });

  it('filters commits by contributor and disables comparison', () => {
    const s = buildSeries({ summary, who: 'bob', compare: true });
    expect(s.total).toBe(4);
    expect(s.prevTotal).toBeNull();
  });

  it('weekly buckets are anchored to the latest day', () => {
    const s = buildSeries({ summary, weekly: true });
    expect(s.rows).toHaveLength(2);
    expect(s.rows[1].key).toBe('2025-03-04'); // last 7 days: Mar 4..10
    expect(s.rows[0].key).toBe('2025-03-01'); // partial first bucket
    expect(s.rows.reduce((n, r) => n + r.value, 0)).toBe(45);
  });

  it('other metrics ignore the contributor filter', () => {
    const s = buildSeries({ summary, metric: 'opened', who: 'ann' });
    expect(s.total).toBe(10);
  });
});

describe('calendar + levels', () => {
  it('pads the first week so weekdays line up', () => {
    // 2025-03-01 is a Saturday -> six leading blanks
    const weeks = buildCalendar(daily);
    expect(weeks[0].slice(0, 6).every((c) => c === null)).toBe(true);
    expect(weeks[0][6].date).toBe('2025-03-01');
    expect(weeks.flat().filter(Boolean)).toHaveLength(10);
  });

  it('levels use quartiles of active days', () => {
    const level = levelScale([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(level(0)).toBe(0);
    expect(level(1)).toBe(1);
    expect(level(8)).toBe(4);
    expect(levelScale([0, 0])(5)).toBe(0);
  });
});
