import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { daysDiff, addDays } from './date';

describe('daysDiff', () => {
  beforeEach(() => {
    // Pin "today" to 2024-01-10
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-10'));
  });
  afterEach(() => vi.useRealTimers());

  it('returns 0 for today', () => {
    expect(daysDiff('2024-01-10')).toBe(0);
  });

  it('returns positive for a past date', () => {
    expect(daysDiff('2024-01-05')).toBe(5);
  });

  it('returns negative for a future date', () => {
    expect(daysDiff('2024-01-15')).toBe(-5);
  });

  it('handles a date 1 year ago', () => {
    expect(daysDiff('2023-01-10')).toBe(365);
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    expect(addDays('2024-01-10', 5)).toBe('2024-01-15');
  });

  it('adds zero days (identity)', () => {
    expect(addDays('2024-01-10', 0)).toBe('2024-01-10');
  });

  it('subtracts days with negative offset', () => {
    expect(addDays('2024-01-10', -3)).toBe('2024-01-07');
  });

  it('correctly rolls over month boundary', () => {
    expect(addDays('2024-01-28', 5)).toBe('2024-02-02');
  });

  it('correctly rolls over year boundary', () => {
    expect(addDays('2023-12-30', 3)).toBe('2024-01-02');
  });

  it('returns a YYYY-MM-DD string', () => {
    expect(addDays('2024-06-01', 1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
