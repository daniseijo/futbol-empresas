// Which of a team's matches to announce, and the message, kept apart
// from run.ts (which reads the database and sends) so they can be tested.

import { siteConfig } from "@/config/site";
import { capitalize, daysBetween, formatLongDate, formatTime } from "@/lib/dates";
import { getVenue, mapsUrl } from "@/lib/sportspress/venues";
import type { Match } from "@/lib/sportspress/types";
import { sendAt, type Schedule } from "./schedule";

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
 * to the fingerprint the channel announced. Without a schedule (the
 * env-configured channels) a match is announced once it is `NOTIFY_DAYS` away;
 * with one, when its time comes (`sendAt`). A change to an announced match goes
 * out straight away.
 */
export function pendingCallUps(matches: Match[], sent: Map<number, string>, now: string, schedule: Schedule | null = null): CallUp[] {
  return matches
    .filter((m) => !m.played && m.date > now)
    .flatMap((match): CallUp[] => {
      const current = fingerprint(match);
      const previous = sent.get(match.id);
      if (previous === current) return [];
      const due = schedule ? previous !== undefined || now >= sendAt(match.date, schedule) : daysBetween(now, match.date) <= NOTIFY_DAYS;
      if (!due) return [];
      return [{ match, kind: previous === undefined ? "new" : "rescheduled", fingerprint: current }];
    })
    .sort((a, b) => a.match.date.localeCompare(b.match.date));
}

/** A channel-neutral announcement; each channel lays it out its own way. */
export interface CallUpMessage {
  kind: CallUp["kind"];
  title: string;
  matchup: string;
  when: string;
  /** "Jueves, 29 de octubre" and "21:10", for Slack's one line each. */
  date: string;
  time: string;
  venue: { name: string; url: string } | null;
  url: string;
  /**
   * The match's share image (its opengraph-image), versioned by the fingerprint:
   * Slack caches images by URL, and a rescheduled match must show its new time.
   */
  imageUrl: string;
  /** For the attendance poll. */
  question: string;
}

export function callUpMessage({ match, kind, fingerprint }: CallUp, teamId: number, today: string): CallUpMessage {
  const venue = getVenue(match.venueId);
  const label = kind === "new" ? "Convocatoria" : "Cambio de horario";
  const day = formatLongDate(match.date, today);
  const rival = match.homeId === teamId ? match.awayName : match.homeName;
  // "miércoles 4", without the month.
  const shortDay = day.split(" ").slice(0, 2).join(" ");
  const [weekday, ...date] = day.split(" ");
  return {
    kind,
    title: match.round ? `${label} · Jornada ${match.round}` : label,
    matchup: `${match.homeName} vs ${match.awayName}`,
    when: `${capitalize(day)} · ${formatTime(match.date)}`,
    date: `${capitalize(weekday)}, ${date.join(" ")}`,
    time: formatTime(match.date),
    venue: venue ? { name: venue.name, url: mapsUrl(venue) } : null,
    url: `${siteConfig.url}/partidos/${match.id}`,
    imageUrl: `${siteConfig.url}/partidos/${match.id}/opengraph-image?v=${encodeURIComponent(fingerprint)}`,
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

/**
 * Slack's Block Kit: the title, then the details worded like the call-ups teams
 * already post by hand. The match's share image goes in as an image block
 * instead of link previews, which can only be turned off for the whole message
 * (the venue's Google Maps link made a useless one). An image block cannot link
 * anywhere, so the link to the site sits right above it. `text` is what notifications show. Slack has no poll
 * without an app of its own, so it asks for reactions.
 */
export function toSlackMessage(message: CallUpMessage, footer: string | null = null) {
  // Slack only needs &, < and > escaped, the same as HTML.
  const link = (url: string, text: string) => `<${url}|${escapeHtml(text)}>`;
  const section = (...lines: (string | null | false)[]) => ({ type: "section", text: { type: "mrkdwn", text: lines.filter(Boolean).join("\n") } });
  return {
    text: `${message.title}: ${message.matchup}, ${message.when}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: `⚽ ${message.title}` } },
      section(
        "¡Hola equipo!",
        message.kind === "new"
          ? "Os dejo por aquí todos los detalles del próximo partido."
          : "⚠️ *Ha cambiado el horario del partido.* Estos son los nuevos detalles:",
      ),
      section(
        `🗓️ *Fecha:* ${escapeHtml(message.date)}`,
        `⏰ *Hora:* ${message.time} h`,
        message.venue && `📍 *Lugar:* ${link(message.venue.url, message.venue.name)}`,
        `🆚 *Encuentro:* ${escapeHtml(message.matchup)}`,
      ),
      section(`👉 *${link(message.url, "Ver el partido en la web")}*`),
      { type: "image", image_url: message.imageUrl, alt_text: `${message.matchup}, ${message.when}` },
      section("Por favor, confirmad vuestra asistencia lo antes posible reaccionando a este mensaje (✅ voy / ❌ no voy)"),
      ...(footer ? [{ type: "divider" }, { type: "context", elements: [{ type: "mrkdwn", text: footer }] }] : []),
    ],
    unfurl_links: false,
    unfurl_media: false,
  };
}
