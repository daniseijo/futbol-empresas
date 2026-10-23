import { siteConfig } from "@/config/site";
import type { Match } from "@/lib/sportspress/types";

const MATCH_MINUTES = 60;

/** Google Calendar link to add a match (1 h, Madrid time). */
export function calendarUrl(match: Match, location: string): string {
  const [date, time] = match.date.split("T");
  const [hours, minutes] = time.split(":").map(Number);
  const end = hours * 60 + minutes + MATCH_MINUTES;
  const stamp = (h: number, m: number) => `${date.replace(/-/g, "")}T${String(h % 24).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${match.homeName} – ${match.awayName}`,
    dates: `${stamp(hours, minutes)}/${stamp(Math.floor(end / 60), end % 60)}`,
    ctz: siteConfig.timeZone,
    location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
