import { describe, expect, it } from 'vitest';
import { formatDate, formatDateShort } from './utils';

describe('date formatting', () => {
  it('formats date-only values without interpreting them as UTC timestamps', () => {
    expect(formatDate('2026-10-18')).toBe('Oct 18, 2026');
    expect(formatDateShort('2026-10-18')).toBe('Oct 18');
  });
});
