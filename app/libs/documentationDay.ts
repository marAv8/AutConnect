export const DOCUMENTATION_DAY_START_HOUR = 6;

/**
 * Returns the calendar date used by active dashboard documentation.
 * Midnight through 5:59:59 a.m. is intentionally outside an active note day.
 */
export function activeDocumentationDate(now = new Date()) {
  if (now.getHours() < DOCUMENTATION_DAY_START_HOUR) {
    return null;
  }

  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function sevenDayHistoryStart(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return start;
}
