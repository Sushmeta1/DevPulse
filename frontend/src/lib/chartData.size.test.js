import { describe, expect, it } from 'vitest';
import { sizeInsight } from './chartData.js';

const b = (label, mergedCount, medianMergeHours) => ({ label, range: '', mergedCount, medianMergeHours });

describe('sizeInsight', () => {
  it('says larger PRs merge slower when the data shows it', () => {
    const r = sizeInsight([b('XS', 5, 4), b('S', 6, 8), b('M', 3, 20), b('L', 0, null), b('XL', 2, 40)]);
    expect(r.kind).toBe('slower');
    expect(r.small.label).toBe('XS');
    expect(r.large.label).toBe('XL');
    expect(r.ratio).toBe(10);
  });

  it('says nothing when there is not enough data to compare', () => {
    expect(sizeInsight([b('XS', 1, 4), b('XL', 1, 40)])).toBeNull(); // one PR per bucket is an anecdote
    expect(sizeInsight([b('M', 5, 10)])).toBeNull();
    expect(sizeInsight([b('XS', 0, null), b('S', 0, null)])).toBeNull();
  });

  it('reports no relationship when merge times are similar', () => {
    expect(sizeInsight([b('XS', 4, 10), b('XL', 4, 11)]).kind).toBe('flat');
  });
});
