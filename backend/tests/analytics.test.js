const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSummary } = require('../services/analyticsService');

const now = new Date('2025-03-10T12:00:00Z');
const base = { days: 7, now };

test('aggregates commits, PRs, contributors and lead time', () => {
  const commits = [
    { author_login: 'ann', committed_at: '2025-03-10T09:00:00Z' },
    { author_login: 'ann', committed_at: '2025-03-10T10:00:00Z' },
    { author_login: 'bob', committed_at: '2025-03-08T10:00:00Z' },
    { author_login: 'old', committed_at: '2025-01-01T10:00:00Z' }, // far outside both periods
  ];
  const pulls = [
    { state: 'merged', author_login: 'ann', created_at: '2025-03-08T00:00:00Z', merged_at: '2025-03-08T10:00:00Z' },
    { state: 'merged', author_login: 'bob', created_at: '2025-03-09T00:00:00Z', merged_at: '2025-03-09T04:00:00Z' },
    { state: 'open', author_login: 'bob', created_at: '2025-03-09T00:00:00Z', merged_at: null },
    { state: 'closed', author_login: 'cy', created_at: '2025-03-09T00:00:00Z', merged_at: null },
  ];
  const s = buildSummary({ ...base, commits, pulls, openPulls: [{ created_at: '2025-03-09T00:00:00Z' }] });

  assert.equal(s.totals.commits, 3);
  assert.equal(s.totals.pullRequests, 4);
  assert.equal(s.totals.mergedPullRequests, 2);
  assert.equal(s.totals.openPullRequests, 1);
  assert.equal(s.totals.closedPullRequests, 1);
  assert.equal(s.totals.contributors, 3);
  assert.equal(s.totals.avgMergeHours, 7); // (10h + 4h) / 2
  assert.equal(s.totals.medianMergeHours, 4);
  assert.equal(s.totals.mergeRate, 67); // 2 merged of 3 finished
  assert.deepEqual(s.totals.busiestDay, { date: '2025-03-10', commits: 2 });
  assert.equal(s.totals.activeDays, 2);

  assert.equal(s.daily.length, 7);
  assert.equal(s.daily[0].date, '2025-03-04');
  assert.equal(s.daily.at(-1).date, '2025-03-10');
  assert.equal(s.daily.reduce((n, d) => n + d.commits, 0), 3);
  assert.equal(s.daily.find((d) => d.date === '2025-03-09').merged, 1);
  assert.equal(s.daily.find((d) => d.date === '2025-03-09').opened, 3);

  const ann = s.topContributors[0];
  assert.equal(ann.login, 'ann');
  assert.equal(ann.commits, 2);
  assert.equal(ann.pullRequests, 1);
  assert.equal(ann.series.length, 7);
  assert.equal(ann.series.at(-1), 2);
  assert.deepEqual(s.pullRequestsByState.map((x) => x.value), [2, 1, 1]);
  assert.deepEqual(s.leadTime.map((b) => b.count), [0, 0, 2, 0, 0, 0]); // 4h and 10h both land in "4-24h"
});

test('lead-time histogram buckets are half-open on the upper bound', () => {
  const mergedAt = Date.parse('2025-03-10T06:00:00Z');
  const mk = (hours) => ({
    state: 'merged', author_login: 'a', merged_at: new Date(mergedAt).toISOString(),
    created_at: new Date(mergedAt - hours * 3600000).toISOString(),
  });
  const s = buildSummary({ ...base, commits: [], pulls: [mk(0.5), mk(1), mk(3.9), mk(24), mk(100), mk(300)] });
  assert.deepEqual(s.leadTime.map((b) => b.count), [1, 2, 0, 1, 1, 1]);
});

test('previous period powers deltas only when available', () => {
  const commits = [
    { author_login: 'ann', committed_at: '2025-03-10T09:00:00Z' },
    { author_login: 'bob', committed_at: '2025-03-01T09:00:00Z' }, // previous 7-day window: Feb 25 - Mar 3
    { author_login: 'bob', committed_at: '2025-02-27T09:00:00Z' },
  ];
  const withPrev = buildSummary({ ...base, commits, pulls: [], previousAvailable: true });
  assert.equal(withPrev.previous.commits, 2);
  assert.equal(withPrev.previous.contributors, 1);
  assert.equal(withPrev.previousCommitsDaily.length, 7);
  assert.equal(withPrev.totals.commits, 1);

  const without = buildSummary({ ...base, commits, pulls: [], previousAvailable: false });
  assert.equal(without.previous, null);
  assert.equal(without.previousCommitsDaily, null);
});

test('buckets by the viewer timezone, not UTC', () => {
  // 21:00 UTC on Mar 9 is already 02:30 on Mar 10 in India (UTC+5:30).
  const commits = [{ author_login: 'ann', committed_at: '2025-03-09T21:00:00Z' }];
  const utc = buildSummary({ ...base, commits, pulls: [] });
  const ist = buildSummary({ ...base, commits, pulls: [], tzOffset: 330 });
  assert.equal(utc.daily.find((d) => d.commits).date, '2025-03-09');
  assert.equal(ist.daily.find((d) => d.commits).date, '2025-03-10');
  // Mar 10 2025 is a Monday; 02:30 local -> hour 2.
  assert.equal(ist.punchcard[1][2], 1);
  assert.equal(utc.punchcard[0][21], 1); // Sunday 21:00 UTC
});

test('commits without a linked GitHub account still count as contributors', () => {
  const commits = [
    { author_login: null, author_name: 'Priya Raman', committed_at: '2025-03-10T09:00:00Z' },
    { author_login: null, author_name: 'Priya Raman', committed_at: '2025-03-10T10:00:00Z' },
    { author_login: 'ann', author_name: 'Ann', committed_at: '2025-03-10T10:00:00Z' },
  ];
  const s = buildSummary({ ...base, commits, pulls: [] });
  assert.equal(s.totals.contributors, 2);
  const priya = s.topContributors.find((p) => p.login === 'Priya Raman');
  assert.equal(priya.linked, false);
  assert.equal(priya.commits, 2);
});

test('open PR aging and streaks', () => {
  const commits = ['2025-03-06', '2025-03-07', '2025-03-08', '2025-03-10'].map((d) => ({
    author_login: 'a', committed_at: `${d}T10:00:00Z`,
  }));
  const s = buildSummary({
    ...base, commits, pulls: [],
    openPulls: [{ created_at: '2025-02-01T00:00:00Z' }, { created_at: '2025-03-09T00:00:00Z' }],
  });
  assert.equal(s.totals.longestStreak, 3);
  assert.equal(s.totals.stalePullRequests, 1);
  assert.equal(s.totals.oldestOpenDays, 37);
});

test('empty repository yields zeroed, well-shaped output', () => {
  const s = buildSummary({ ...base, days: 3, commits: [], pulls: [] });
  assert.equal(s.totals.commits, 0);
  assert.equal(s.totals.avgMergeHours, null);
  assert.equal(s.totals.medianMergeHours, null);
  assert.equal(s.totals.mergeRate, null);
  assert.equal(s.totals.busiestDay, null);
  assert.equal(s.daily.length, 3);
  assert.equal(s.punchcard.length, 7);
  assert.equal(s.punchcard[0].length, 24);
  assert.deepEqual(s.topContributors, []);
  assert.equal(s.leadTime.length, 6);
});

test('ignores commits dated in the future (clock skew)', () => {
  const s = buildSummary({ ...base, commits: [{ author_login: 'a', committed_at: '2025-04-01T00:00:00Z' }], pulls: [] });
  assert.equal(s.totals.commits, 0);
});
