import { CLINICAL_TIME_ZONE } from "./dateTime";

export const TEAM_FOCUS_BUSINESS_DAY_LIMIT = 5;

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

const clinicalDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CLINICAL_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

function clinicalCalendarDate(value: Date | string | number): CalendarDate {
  const parts = clinicalDateFormatter.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
  };
}

function utcCalendarDate({ year, month, day }: CalendarDate) {
  return new Date(Date.UTC(year, month - 1, day));
}

function teamFocusLastVisibleDate(
  displayStartedAt: Date | string | number
) {
  const cursor = utcCalendarDate(clinicalCalendarDate(displayStartedAt));
  let visibleBusinessDays = 0;

  while (visibleBusinessDays < TEAM_FOCUS_BUSINESS_DAY_LIMIT) {
    const dayOfWeek = cursor.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      visibleBusinessDays += 1;
    }

    if (visibleBusinessDays < TEAM_FOCUS_BUSINESS_DAY_LIMIT) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return cursor;
}

/**
 * Counts working days inclusively in the application's clinical timezone.
 * Weekends remain visible but do not consume one of the five display days.
 */
export function teamFocusBusinessDaysElapsed(
  displayStartedAt: Date | string | number,
  now: Date | string | number = new Date()
) {
  const start = utcCalendarDate(clinicalCalendarDate(displayStartedAt));
  const current = utcCalendarDate(clinicalCalendarDate(now));

  if (current < start) {
    return 0;
  }

  let businessDays = 0;
  for (
    const cursor = new Date(start);
    cursor <= current;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const dayOfWeek = cursor.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays += 1;
    }
  }

  return businessDays;
}

export function isTeamFocusVisible(
  displayStartedAt: Date | string | number,
  now: Date | string | number = new Date()
) {
  const start = utcCalendarDate(clinicalCalendarDate(displayStartedAt));
  const current = utcCalendarDate(clinicalCalendarDate(now));
  if (current < start) {
    return false;
  }

  return current <= teamFocusLastVisibleDate(displayStartedAt);
}
