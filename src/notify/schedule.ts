// When a subscribed Slack channel gets each call-up: on the last chosen weekday
// before the match, at the chosen hour. Weekdays only, so it never lands on a
// weekend (a Tuesday match with "3 days before" would have).

import { addDays, weekdayName, weekdayOf } from "@/lib/dates";

export interface Schedule {
  /** 1 (Monday) to 5 (Friday). */
  weekday: number;
  /** "HH:00", Madrid time. */
  time: string;
}

export const DEFAULT_SCHEDULE: Schedule = { weekday: 4, time: "10:00" };

export const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5];

/** Whole hours: the notify workflow runs on the hour, from 07:00 to 22:00. */
export const TIME_OPTIONS = Array.from({ length: 16 }, (_, i) => `${String(7 + i).padStart(2, "0")}:00`);

/** A schedule from a form or a URL, or null if it is not one of the options. */
export function parseSchedule(weekday: unknown, time: unknown): Schedule | null {
  const day = Number(weekday);
  if (!WEEKDAY_OPTIONS.includes(day) || typeof time !== "string" || !TIME_OPTIONS.includes(time)) return null;
  return { weekday: day, time };
}

/** When the call-up of a match is due: the last `weekday` strictly before its day, at `time`. */
export function sendAt(matchDate: string, { weekday, time }: Schedule): string {
  const back = (weekdayOf(matchDate) - weekday + 7) % 7 || 7;
  return `${addDays(matchDate, -back)}T${time}`;
}

/** "el jueves antes de cada partido, a las 10:00". */
export function describeSchedule({ weekday, time }: Schedule): string {
  return `el ${weekdayName(weekday)} antes de cada partido, a las ${time}`;
}
