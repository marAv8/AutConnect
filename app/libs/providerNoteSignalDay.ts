import { CLINICAL_TIME_ZONE } from "./dateTime";

const signalDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINICAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type SignalDayParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function providerNoteSignalDayKey(value: Date | string | number) {
  const { year, month, day } = signalDayParts(new Date(value));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function providerNoteSignalDayWindow(now = new Date()) {
  const current = signalDayParts(now);
  const nextCalendarDay = new Date(
    Date.UTC(current.year, current.month - 1, current.day + 1)
  );

  return {
    start: zonedDateTimeToInstant({
      ...current,
      hour: 0,
      minute: 0,
      second: 0,
    }),
    end: zonedDateTimeToInstant({
      year: nextCalendarDay.getUTCFullYear(),
      month: nextCalendarDay.getUTCMonth() + 1,
      day: nextCalendarDay.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    }),
  };
}

export function millisecondsUntilNextProviderNoteSignalDay(now = new Date()) {
  return Math.max(0, providerNoteSignalDayWindow(now).end.getTime() - now.getTime());
}

function signalDayParts(value: Date): SignalDayParts {
  const parts = Object.fromEntries(
    signalDayFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function zonedDateTimeToInstant(target: SignalDayParts) {
  const targetAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second
  );
  let candidate = targetAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = signalDayParts(new Date(candidate));
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    candidate += targetAsUtc - actualAsUtc;
  }

  return new Date(candidate);
}
