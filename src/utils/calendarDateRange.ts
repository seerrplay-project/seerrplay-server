const formatLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const atLocalNoon = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);

const addLocalDays = (date: Date, days: number) => {
  const result = atLocalNoon(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Returns the seven local dates before and after an anchor date, inclusive.
 * Working from local noon avoids crossing a daylight-saving boundary at midnight.
 */
export const getCalendarDateRange = (anchor = new Date()): string[] => {
  const start = addLocalDays(anchor, -7);

  return Array.from({ length: 15 }, (_, index) =>
    formatLocalDate(addLocalDays(start, index))
  );
};

/**
 * Returns the Monday which starts the three-week API window containing the
 * visible calendar dates.
 */
export const getCalendarQueryStart = (anchor = new Date()): string => {
  const firstVisibleDay = addLocalDays(anchor, -7);
  const weekday = firstVisibleDay.getDay() || 7;

  return formatLocalDate(addLocalDays(firstVisibleDay, 1 - weekday));
};
