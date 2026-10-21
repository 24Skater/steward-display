import { createContext, useContext } from "react";

/**
 * The church's time zone, for widgets that tell the time.
 *
 * A TV's own clock zone is whatever its owner left it on (a Raspberry Pi ships
 * on UTC), so on a paired TV every clock, date and countdown uses the church's
 * setting instead. Undefined means "this browser's zone", which is right in the
 * editor, where the person is.
 */
export const TimeZoneContext = createContext<string | undefined>(undefined);

export function useTimeZone(): string | undefined {
  return useContext(TimeZoneContext);
}

export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** What a wall clock in `timeZone` reads at `instant`. */
export function wallClock(instant: Date, timeZone?: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Minutes `timeZone` is ahead of UTC at `instant`. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/**
 * The instant a wall-clock time such as "2026-12-24T18:00" (what a
 * datetime-local input produces) happens in `timeZone`. Without a zone it is
 * read in this browser's zone, as `new Date()` would.
 */
export function wallTimeToInstant(value: string, timeZone?: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!timeZone) return new Date(value);
  const [, y, mo, d, h, mi, s] = match;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  // Two passes settle the offset either side of a daylight-saving change.
  let instant = guess - offsetMinutes(new Date(guess), timeZone) * 60_000;
  instant = guess - offsetMinutes(new Date(instant), timeZone) * 60_000;
  return new Date(instant);
}
