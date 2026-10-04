import { describe, expect, it } from 'vitest';
import { deriveSignals } from './signals.js';

const punch = () => Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
const base = () => ({
  range: { days: 30 },
  totals: { commits: 100, contributors: 4, medianMergeHours: 10, p90MergeHours: 40, stalePullRequests: 0, openPullRequests: 2, oldestOpenDays: 3 },
  previous: { commits: 100 },
  topContributors: [{ login: 'ann', commits: 40 }],
  punchcard: punch(),
});
const byId = (list, id) => list.find((s) => s.id === id);

describe('deriveSignals', () => {
  it('rates a healthy repository', () => {
    const s = base();
    s.punchcard[2][10] = 50;
    const out = deriveSignals(s);
    expect(byId(out, 'review').status).toBe('good');
    expect(byId(out, 'stale').status).toBe('good');
    expect(byId(out, 'spread').status).toBe('good');
    expect(byId(out, 'rhythm').status).toBe('good');
    expect(byId(out, 'momentum').value).toBe('0%');
  });

  it('flags slow reviews, stale PRs, concentration and off-hours work', () => {
    const s = base();
    s.totals.medianMergeHours = 100;
    s.totals.stalePullRequests = 5;
    s.topContributors[0].commits = 90;
    s.punchcard[0][3] = 10; // Sunday 03:00
    s.previous.commits = 300;
    const out = deriveSignals(s);
    expect(byId(out, 'review').status).toBe('bad');
    expect(byId(out, 'stale').status).toBe('bad');
    expect(byId(out, 'spread').status).toBe('bad');
    expect(byId(out, 'rhythm').status).toBe('bad');
    expect(byId(out, 'momentum').status).toBe('bad');
  });

  it('degrades gracefully with no data', () => {
    const s = base();
    s.totals = { ...s.totals, commits: 0, contributors: 0, medianMergeHours: null };
    s.previous = null;
    s.topContributors = [];
    const out = deriveSignals(s);
    expect(byId(out, 'review').status).toBe('neutral');
    expect(byId(out, 'spread').status).toBe('neutral');
    expect(byId(out, 'rhythm')).toBeUndefined();
    expect(byId(out, 'momentum')).toBeUndefined();
  });

  it('calls out a single contributor', () => {
    const s = base();
    s.totals.contributors = 1;
    expect(byId(deriveSignals(s), 'spread').value).toBe('1 person');
  });
});
