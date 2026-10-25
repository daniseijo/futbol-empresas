// Which of a team's matches to announce, and the message, kept apart
// from run.ts (which reads the database and sends) so they can be tested.

import { siteConfig } from "@/config/site";
import { capitalize, daysBetween, formatLongDate, formatTime } from "@/lib/dates";
import { getVenue, mapsUrl } from "@/lib/sportspress/venues";
import type { Match } from "@/lib/sportspress/types";

/**
 * How far ahead a match is announced. The league can publish weeks of fixtures
 * at once: this keeps them from arriving all together, each one comes in when
 * it is this close.
 */
export const NOTIFY_DAYS = 14;

export interface CallUp {
  match: Match;
  /** "new": first announcement; "rescheduled": its date or venue changed since. */
  kind: "new" | "rescheduled";
  fingerprint: string;
}

/** What an announcement says about a match: when it changes, it is announced again. */
export function fingerprint(match: Pick<Match, "date" | "venueId">): string {
  return `${match.date}|${match.venueId ?? ""}`;
}

/**
 * Upcoming matches to announce on a channel, soonest first. `sent` maps a match
 * to the fingerprint the channel announced.
 */
export function pendingCallUps(matches: Match[], sent: Map<number, string>, now: string): CallUp[] {
  return matches
    .filter((m) => !m.played && m.date > now && daysBetween(now, m.date) <= NOTIFY_DAYS)
    .flatMap((match): CallUp[] => {
      const current = fingerprint(match);
      const previous = sent.get(match.id);
      if (previous === current) return [];
      return [{ match, kind: previous === undefined ? "new" : "rescheduled", fingerprint: current }];
    })
    .sort((a, b) => a.match.date.localeCompare(b.match.date));
}

/** A channel-neutral announcement; each channel lays it out its own way. */
export interface CallUpMessage {
  title: string;
  matchup: string;
  when: string;
  venue: { name: string; url: string } | null;
  url: string;
  /** For the attendance poll. */
  question: string;
}

export function callUpMessage({ match, kind }: CallUp, teamId: number, today: string): CallUpMessage {
  const venue = getVenue(match.venueId);
  const label = kind === "new" ? "Convocatoria" : "Cambio de horario";
  const day = formatLongDate(match.date, today);
  const rival = match.homeId === teamId ? match.awayName : match.homeName;
  // "miércoles 4", without the month.
  const shortDay = day.split(" ").slice(0, 2).join(" ");
  return {
    title: match.round ? `${label} · Jornada ${match.round}` : label,
    matchup: `${match.homeName} vs ${match.awayName}`,
    when: `${capitalize(day)} · ${formatTime(match.date)}`,
    venue: venue ? { name: venue.name, url: mapsUrl(venue) } : null,
    url: `${siteConfig.url}/partidos/${match.id}`,
    question: `¿Vas el ${shortDay} contra ${rival}?`,
  };
}

export const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Telegram's HTML formatting (parse_mode "HTML"). */
export function toTelegramHtml(message: CallUpMessage): string {
  const link = (url: string, text: string) => `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;
  return [
    `<b>⚽ ${escapeHtml(message.title)}</b>`,
    `<b>${escapeHtml(message.matchup)}</b>`,
    `📅 ${escapeHtml(message.when)}`,
    message.venue && `📍 ${link(message.venue.url, message.venue.name)}`,
    "",
    link(message.url, "Ver el partido"),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** Slack's mrkdwn. Slack has no poll without an app of its own, so it asks for reactions. */
export function toSlackMrkdwn(message: CallUpMessage): string {
  // Slack only needs &, < and > escaped, the same as HTML.
  const link = (url: string, text: string) => `<${url}|${escapeHtml(text)}>`;
  return [
    `*⚽ ${escapeHtml(message.title)}*`,
    `*${escapeHtml(message.matchup)}*`,
    `📅 ${escapeHtml(message.when)}`,
    message.venue && `📍 ${link(message.venue.url, message.venue.name)}`,
    "",
    `${escapeHtml(message.question)} Reacciona con ✅ o ❌`,
    link(message.url, "Ver el partido"),
  ]
    .filter((line) => line !== null)
    .join("\n");
}
