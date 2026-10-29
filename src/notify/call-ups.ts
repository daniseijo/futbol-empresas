// Which of a team's matches to announce, and the message, kept apart
// from run.ts (which reads the database and sends) so they can be tested.

import { siteConfig } from "@/config/site";
import { capitalize, daysBetween, formatLongDate, formatTime } from "@/lib/dates";
import type { ChampionsStage } from "@/lib/sportspress/champions";
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
  /** What changed, for a rescheduled one. */
  change?: Change;
  fingerprint: string;
}

export type Change = "date" | "venue" | "both";

/** What differs between two fingerprints. */
function changeBetween(previous: string, current: string): Change {
  const [oldDate, oldVenue] = previous.split("|");
  const [newDate, newVenue] = current.split("|");
  if (oldDate !== newDate && oldVenue !== newVenue) return "both";
  return oldDate !== newDate ? "date" : "venue";
}

const CHANGE_LABELS: Record<Change, string> = { date: "Cambio de horario", venue: "Cambio de campo", both: "Cambio de horario y campo" };
const CHANGE_NOTICES: Record<Change, string> = {
  date: "Ha cambiado el horario del partido.",
  venue: "Ha cambiado el campo del partido.",
  both: "Han cambiado el horario y el campo del partido.",
};

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
      if (previous === undefined) return [{ match, kind: "new", fingerprint: current }];
      return [{ match, kind: "rescheduled", change: changeBetween(previous, current), fingerprint: current }];
    })
    .sort((a, b) => a.match.date.localeCompare(b.match.date));
}

/** A channel-neutral announcement; each channel lays it out its own way. */
export interface CallUpMessage {
  kind: CallUp["kind"];
  change: Change | null;
  title: string;
  /** "Champions · Fase liga · Sector Banca y Financiero" for a Champions match, null for any other. */
  competition: string | null;
  /** What the message is about: "el próximo partido", "el primer partido de la Champions". */
  subject: string;
  matchup: string;
  when: string;
  /** "Jueves, 29 de octubre" and "21:10", for Slack's one line each. */
  date: string;
  time: string;
  venue: { name: string; url: string } | null;
  url: string;
  /**
   * The match's call-up image (/partidos/<id>/convocatoria.png), versioned by the fingerprint:
   * Slack caches images by URL, and a rescheduled match must show its new time.
   */
  imageUrl: string;
  /** For the attendance poll. */
  question: string;
}

/**
 * `champions` is where a Champions match sits (see `championsStage`): its call-up says so in the title
 * ("Convocatoria Champions · Jornada 1") and in a line of its own, and names the knockout phase for a match
 * without a round.
 */
export function callUpMessage(
  { match, kind, change, fingerprint }: CallUp,
  teamId: number,
  today: string,
  champions: ChampionsStage | null = null,
): CallUpMessage {
  const venue = getVenue(match.venueId);
  const label = kind === "new" ? (champions ? "Convocatoria Champions" : "Convocatoria") : CHANGE_LABELS[change ?? "date"];
  const round = match.round ? `Jornada ${match.round}` : champions && champions.phase !== "Fase liga" ? champions.phase : null;
  const first = champions?.phase === "Fase liga" && match.round === 1;
  const day = formatLongDate(match.date, today);
  const rival = match.homeId === teamId ? match.awayName : match.homeName;
  // "miércoles 4", without the month.
  const shortDay = day.split(" ").slice(0, 2).join(" ");
  const [weekday, ...date] = day.split(" ");
  return {
    kind,
    change: kind === "new" ? null : (change ?? "date"),
    title: [label, kind !== "new" && champions && "Champions", round].filter(Boolean).join(" · "),
    competition: champions
      ? ["Champions", champions.phase, champions.sector && `Sector ${champions.sector}`].filter(Boolean).join(" · ")
      : null,
    subject: champions ? `${first ? "primer" : "próximo"} partido de la Champions` : "próximo partido",
    matchup: `${match.homeName} vs ${match.awayName}`,
    when: `${capitalize(day)} · ${formatTime(match.date)}`,
    date: `${capitalize(weekday)}, ${date.join(" ")}`,
    time: formatTime(match.date),
    venue: venue ? { name: venue.name, url: mapsUrl(venue) } : null,
    url: `${siteConfig.url}/partidos/${match.id}`,
    imageUrl: `${siteConfig.url}/partidos/${match.id}/convocatoria.png?v=${encodeURIComponent(fingerprint)}`,
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
    message.competition && `🏆 ${escapeHtml(message.competition)}`,
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
        message.change === null
          ? `Os dejo por aquí todos los detalles del ${message.subject}.`
          : `⚠️ *${CHANGE_NOTICES[message.change]}* Estos son los nuevos detalles:`,
      ),
      section(
        `🗓️ *Fecha:* ${escapeHtml(message.date)}`,
        `⏰ *Hora:* ${message.time} h`,
        message.venue && `📍 *Lugar:* ${link(message.venue.url, message.venue.name)}`,
        `🆚 *Encuentro:* ${escapeHtml(message.matchup)}`,
        message.competition && `🏆 *Competición:* ${escapeHtml(message.competition)}`,
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
