const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSummary } = require('../services/analyticsService');

const now = new Date('2025-03-10T12:00:00Z');

test('buildSummary aggregates commits, PRs and contributors', () => {
  const commits = [
    { author_login: 'ann', committed_at: '2025-03-10T09:00:00Z' },
    { author_login: 'ann', committed_at: '2025-03-10T10:00:00Z' },
    { author_login: 'bob', committed_at: '2025-03-08T10:00:00Z' },
    { author_login: 'old', committed_at: '2025-01-01T10:00:00Z' }, // outside window
  ];
  const pulls = [
    { state: 'merged', author_login: 'ann', created_at: '2025-03-08T00:00:00Z', merged_at: '2025-03-08T10:00:00Z' },
    { state: 'merged', author_login: 'bob', created_at: '2025-03-09T00:00:00Z', merged_at: '2025-03-09T04:00:00Z' },
    { state: 'open', author_login: 'bob', created_at: '2025-03-09T00:00:00Z', merged_at: null },
    { state: 'closed', author_login: 'cy', created_at: '2025-03-09T00:00:00Z', merged_at: null },
  ];
  const s = buildSummary({ commits, pulls, days: 7, now });

  assert.equal(s.totals.commits, 3);
  assert.equal(s.totals.pullRequests, 4);
  assert.equal(s.totals.mergedPullRequests, 2);
  assert.equal(s.totals.openPullRequests, 1);
  assert.equal(s.totals.closedPullRequests, 1);
  assert.equal(s.totals.contributors, 3);
  assert.equal(s.totals.avgMergeHours, 7); // (10h + 4h) / 2
  assert.deepEqual(s.totals.busiestDay, { date: '2025-03-10', commits: 2 });

  assert.equal(s.commitsByDay.length, 7);
  assert.equal(s.commitsByDay[0].date, '2025-03-04');
  assert.equal(s.commitsByDay.at(-1).date, '2025-03-10');
  assert.equal(s.commitsByDay.reduce((n, d) => n + d.commits, 0), 3);

  assert.deepEqual(s.topContributors[0], { login: 'ann', commits: 2, pullRequests: 1 });
  assert.deepEqual(s.pullRequestsByState.map((x) => x.value), [2, 1, 1]);
});

test('buildSummary handles an empty repository', () => {
  const s = buildSummary({ commits: [], pulls: [], days: 3, now });
  assert.equal(s.totals.commits, 0);
  assert.equal(s.totals.avgMergeHours, null);
  assert.equal(s.totals.busiestDay, null);
  assert.equal(s.commitsByDay.length, 3);
  assert.deepEqual(s.topContributors, []);
});
