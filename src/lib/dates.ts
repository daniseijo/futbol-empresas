import { siteConfig } from "@/config/site";

// API dates are Madrid local time without a zone ("2026-10-22T21:00:38").
// We handle them as "YYYY-MM-DDTHH:mm" strings and only use Date to get the
// weekday or "now" in Madrid.

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function toLocalStamp(apiDate: string): string {
  return apiDate.slice(0, 16);
}

/** Current date and time in Madrid, in the same format as the API's. */
export function nowInMadrid(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: siteConfig.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function parts(stamp: string) {
  const [date, time = "00:00"] = stamp.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, weekday, time: time.slice(0, 5) };
}

export function dayKey(stamp: string): string {
  return stamp.slice(0, 10);
}

export function formatTime(stamp: string): string {
  return parts(stamp).time;
}

/** "Jue 15 oct" */
export function formatShortDate(stamp: string): string {
  const { day, month, weekday } = parts(stamp);
  return `${WEEKDAYS_SHORT[weekday]} ${day} ${MONTHS_SHORT[month - 1]}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "jueves 22 de octubre" */
export function formatLongDate(stamp: string): string {
  const { day, month, weekday } = parts(stamp);
  return `${WEEKDAYS[weekday]} ${day} de ${MONTHS[month - 1]}`;
}

export function formatNewsDate(stamp: string): string {
  const { day, month, year } = parts(stamp);
  return `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
}

/** Calendar days from `from` to `to`, ignoring the time of day. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${dayKey(to)}T00:00:00Z`) - Date.parse(`${dayKey(from)}T00:00:00Z`)) / 86_400_000);
}

/** "Hoy", "Mañana" or the short date, relative to the reference day. */
export function relativeDay(stamp: string, today: string): string {
  const diff = daysBetween(today, stamp);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  return formatShortDate(stamp);
}

/** Minutes from `from` to `to`, two Madrid times in the API format. */
export function minutesBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to.slice(0, 16)}:00Z`) - Date.parse(`${from.slice(0, 16)}:00Z`)) / 60_000);
}

export function addDays(stamp: string, days: number): string {
  const date = new Date(`${dayKey(stamp)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
