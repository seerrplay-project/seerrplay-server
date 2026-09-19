import { getCalendar, isCalendarRangeAllowed } from '@server/lib/calendar';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const calendarRoutes = Router();
const weekPattern = /^\d{4}-\d{2}-\d{2}$/;

calendarRoutes.get(
  '/',
  rateLimit({ windowMs: 60 * 1000, max: 30 }),
  async (req, res, next) => {
    const week = typeof req.query.week === 'string' ? req.query.week : '';
    const timezone =
      typeof req.query.timezone === 'string' ? req.query.timezone : '';
    const weeksValue =
      typeof req.query.weeks === 'string' ? req.query.weeks : '1';
    const weeks = Number(weeksValue);
    const parsed = new Date(`${week}T00:00:00.000Z`);
    if (
      !weekPattern.test(week) ||
      Number.isNaN(parsed.valueOf()) ||
      parsed.toISOString().slice(0, 10) !== week ||
      parsed.getUTCDay() !== 1
    ) {
      return next({
        status: 400,
        message: 'week must be a Monday in YYYY-MM-DD format.',
      });
    }
    if (!/^[1-3]$/.test(weeksValue)) {
      return next({
        status: 400,
        message: 'weeks must be an integer between 1 and 3.',
      });
    }
    if (!isCalendarRangeAllowed(week, weeks)) {
      return next({
        status: 400,
        message: 'week is outside the supported calendar range.',
      });
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    } catch {
      return next({
        status: 400,
        message: 'timezone must be a valid IANA timezone.',
      });
    }
    try {
      return res.status(200).json(await getCalendar({ week, timezone, weeks }));
    } catch (error) {
      return next(error);
    }
  }
);

export default calendarRoutes;
