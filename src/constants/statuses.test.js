import { describe, it, expect } from 'vitest';
import { STATUS_LABELS, STATUS_MAP } from './statuses';

describe('STATUS_LABELS', () => {
  it('has a label for every key in STATUS_MAP', () => {
    for (const key of Object.keys(STATUS_MAP)) {
      expect(STATUS_LABELS).toHaveProperty(key);
      expect(typeof STATUS_LABELS[key]).toBe('string');
      expect(STATUS_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it('contains expected Russian labels for common statuses', () => {
    expect(STATUS_LABELS.active).toBe('Активен');
    expect(STATUS_LABELS.completed).toBe('Завершён');
    expect(STATUS_LABELS.draft).toBe('Черновик');
    expect(STATUS_LABELS.paid).toBe('Оплачен');
    expect(STATUS_LABELS.overdue).toBe('Просрочен');
  });
});

describe('STATUS_MAP', () => {
  const validBadgeClasses = [
    'badge-green', 'badge-blue', 'badge-orange',
    'badge-gray', 'badge-purple', 'badge-red', 'badge-yellow',
  ];

  it('maps every status to a valid badge class', () => {
    for (const [status, cls] of Object.entries(STATUS_MAP)) {
      expect(validBadgeClasses).toContain(cls);
    }
  });

  it('marks "active" as green', () => {
    expect(STATUS_MAP.active).toBe('badge-green');
  });

  it('marks "overdue" as red', () => {
    expect(STATUS_MAP.overdue).toBe('badge-red');
  });

  it('marks "draft" as yellow', () => {
    expect(STATUS_MAP.draft).toBe('badge-yellow');
  });

  it('marks "completed" as purple', () => {
    expect(STATUS_MAP.completed).toBe('badge-purple');
  });

  it('marks "in_progress" as blue', () => {
    expect(STATUS_MAP.in_progress).toBe('badge-blue');
  });

  it('has all STATUS_LABELS keys covered', () => {
    for (const key of Object.keys(STATUS_LABELS)) {
      expect(STATUS_MAP).toHaveProperty(key);
    }
  });
});
