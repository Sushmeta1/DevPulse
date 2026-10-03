import { describe, expect, it } from 'vitest';
import { formatDay, formatHours, timeAgo } from './format.js';

describe('format helpers', () => {
  it('formats merge durations', () => {
    expect(formatHours(null)).toBe('-');
    expect(formatHours(0.5)).toBe('30m');
    expect(formatHours(7)).toBe('7.0h');
    expect(formatHours(72)).toBe('3.0d');
  });

  it('formats relative times', () => {
    const now = new Date('2025-03-10T12:00:00Z').getTime();
    expect(timeAgo('2025-03-10T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2025-03-10T11:30:00Z', now)).toBe('30m ago');
    expect(timeAgo('2025-03-10T07:00:00Z', now)).toBe('5h ago');
    expect(timeAgo('2025-03-07T12:00:00Z', now)).toBe('3d ago');
  });

  it('formats chart days in UTC', () => {
    expect(formatDay('2025-03-04')).toMatch(/Mar\s?4|4\s?Mar/);
  });
});
