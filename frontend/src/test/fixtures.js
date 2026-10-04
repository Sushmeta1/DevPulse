const daily = Array.from({ length: 14 }, (_, i) => ({
  date: `2025-03-${String(i + 1).padStart(2, '0')}`, commits: i % 5, opened: i % 3, merged: i % 2,
}));

export const summary = {
  range: { days: 14, since: '2025-03-01', until: '2025-03-14', tzOffset: 0, previousAvailable: true },
  totals: {
    commits: 28, pullRequests: 5, mergedPullRequests: 3, openPullRequests: 2, closedPullRequests: 0, contributors: 2,
    activeDays: 11, longestStreak: 4, avgMergeHours: 12, medianMergeHours: 10, p90MergeHours: 30, mergeRate: 100,
    stalePullRequests: 1, oldestOpenDays: 20, busiestDay: { date: '2025-03-05', commits: 4 },
  },
  previous: { commits: 14, pullRequests: 5, mergedPullRequests: 2, contributors: 2, activeDays: 8, medianMergeHours: 20 },
  daily,
  previousCommitsDaily: daily.map(() => 1),
  pullRequestsByState: [{ name: 'Merged', value: 3 }, { name: 'Open', value: 2 }, { name: 'Closed', value: 0 }],
  leadTime: [{ label: '< 1h', count: 0 }, { label: '1-4h', count: 1 }, { label: '4-24h', count: 2 }, { label: '1-3d', count: 0 }, { label: '3-7d', count: 0 }, { label: '> 7d', count: 0 }],
  punchcard: Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => (d === 2 && h === 14 ? 5 : 0))),
  topContributors: [
    { login: 'ann', name: 'Ann Lee', linked: true, commits: 20, pullRequests: 3, activeDays: 9, series: daily.map((d) => d.commits) },
    { login: 'Sam Okafor', name: 'Sam Okafor', linked: false, commits: 8, pullRequests: 0, activeDays: 4, series: daily.map(() => 0) },
  ],
  dataQuality: { truncated: false, historyFrom: null, incomplete: false },
};

export const pulls = [
  { number: 3, title: 'Add retry logic', state: 'open', authorLogin: 'ann', createdAt: '2025-01-01T00:00:00Z', mergedAt: null, htmlUrl: '#' },
  { number: 2, title: 'Fix flaky test', state: 'merged', authorLogin: 'bob', createdAt: '2025-03-01T00:00:00Z', mergedAt: '2025-03-01T10:00:00Z', htmlUrl: '#' },
  { number: 1, title: 'Remove dead code', state: 'closed', authorLogin: 'ann', createdAt: '2025-02-01T00:00:00Z', mergedAt: null, htmlUrl: '#' },
];
