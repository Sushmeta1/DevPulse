import { describe, expect, it } from 'vitest';
import { compare, formatHours, formatNumber, hueFor, initials, plural, timeAgo } from './format.js';

describe('initials (worst-case names)', () => {
  it.each([
    ['Maya Chen', 'MC'],
    ['Jo', 'JO'],
    ['J', 'J'],
    ['dana', 'DA'],
    ['  Sam   Lee ', 'SL'],
    ['Aleksandra Wiśniewska-Kowalczyk', 'AK'],
    ['María José de la Cruz y Fernández', 'MF'],
    ['Ólafur Darri Ólafsson', 'ÓÓ'],
    ['王秀英', '王秀'],
    ['🦊 Fox', 'FO'],
    ['Kenji 🦊 Watanabe', 'KW'],
    ['', '?'],
    [null, '?'],
    ['🦊', '?'],
  ])('%j -> %s', (input, expected) => {
    expect(initials(input)).toBe(expected);
  });
});

describe('formatting', () => {
  it('pluralises with locale separators', () => {
    expect(plural(0, 'commit')).toBe('0 commits');
    expect(plural(1, 'commit')).toBe('1 commit');
    expect(plural(1284, 'commit')).toBe('1,284 commits');
  });

  it('formats lead times', () => {
    expect(formatHours(null)).toBe('-');
    expect(formatHours(0.01)).toBe('1m');
    expect(formatHours(0.5)).toBe('30m');
    expect(formatHours(7.46)).toBe('7.5h');
    expect(formatHours(30)).toBe('30h');
    expect(formatHours(72)).toBe('3d');
    expect(formatHours(1284)).toBe('54d');
  });

  it('formats numbers with separators', () => {
    expect(formatNumber(1284)).toBe('1,284');
  });

  it('formats relative times, switching to dates after a week', () => {
    const now = new Date('2025-03-10T12:00:00Z').getTime();
    expect(timeAgo('2025-03-10T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2025-03-10T11:30:00Z', now)).toBe('30 minutes ago');
    expect(timeAgo('2025-03-10T07:00:00Z', now)).toBe('5 hours ago');
    expect(timeAgo('2025-03-09T12:00:00Z', now)).toBe('yesterday');
    expect(timeAgo('2025-03-07T12:00:00Z', now)).toBe('3 days ago');
    expect(timeAgo('2025-02-01T12:00:00Z', now)).toMatch(/Feb\s?1|1\s?Feb/);
    expect(timeAgo('2024-02-01T12:00:00Z', now)).toMatch(/2024/);
    expect(timeAgo('garbage', now)).toBe('-');
  });

  it('hues are stable', () => {
    expect(hueFor('maya')).toBe(hueFor('maya'));
    expect(hueFor('maya')).toBeGreaterThanOrEqual(0);
    expect(hueFor('maya')).toBeLessThan(360);
  });
});

describe('compare', () => {
  it('handles every edge', () => {
    expect(compare(10, null)).toEqual({ kind: 'none', pct: null });
    expect(compare(null, 10)).toEqual({ kind: 'none', pct: null });
    expect(compare(5, 0)).toEqual({ kind: 'new', pct: null });
    expect(compare(0, 0)).toEqual({ kind: 'flat', pct: 0 });
    expect(compare(10, 10)).toEqual({ kind: 'flat', pct: 0 });
    expect(compare(15, 10)).toEqual({ kind: 'up', pct: 50 });
    expect(compare(5, 10)).toEqual({ kind: 'down', pct: -50 });
  });
});
