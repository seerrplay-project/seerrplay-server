import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getCalendarDateRange,
  getCalendarQueryStart,
} from './calendarDateRange';

const localDate = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day, 12);

const formatLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

describe('getCalendarDateRange', () => {
  it('returns the seven local dates before and after the anchor date', () => {
    assert.deepEqual(getCalendarDateRange(localDate(2026, 9, 20)), [
      '2026-09-13',
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
  });

  it('crosses month and year boundaries without changing the window length', () => {
    const days = getCalendarDateRange(localDate(2026, 1, 1));

    assert.equal(days.length, 15);
    assert.equal(days[0], '2025-12-25');
    assert.equal(days[7], '2026-01-01');
    assert.equal(days[14], '2026-01-08');
  });

  it('keeps each local calendar day exactly once across daylight-saving changes', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'Europe/Paris';

    try {
      for (const anchor of [localDate(2026, 3, 29), localDate(2026, 10, 25)]) {
        const days = getCalendarDateRange(anchor);

        assert.equal(days.length, 15);
        assert.equal(new Set(days).size, 15);
        assert.equal(days[7], formatLocalDate(anchor));
      }
    } finally {
      if (previousTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTimezone;
      }
    }
  });
});

describe('getCalendarQueryStart', () => {
  it('returns the Monday that starts a three-week API window containing all displayed dates', () => {
    const anchor = localDate(2026, 9, 20);
    const start = getCalendarQueryStart(anchor);
    const dates = getCalendarDateRange(anchor);

    assert.equal(start, '2026-09-07');
    assert.equal(new Date(`${start}T12:00:00`).getDay(), 1);
    assert.ok(dates.every((date) => date >= start && date <= '2026-09-27'));
  });
});
