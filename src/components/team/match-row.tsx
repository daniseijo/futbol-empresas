import Link from "next/link";
import type { ChampionsStage } from "@/lib/sportspress/champions";
import { formatShortDate, relativeDay, resultOverdue } from "@/lib/dates";
import type { Match } from "@/lib/sportspress/types";
import { outcomeFor } from "@/lib/standings";
import { ChampionsBadge } from "../champions";
import { Crest } from "../crest";
import { OutcomeBadge } from "../form-badges";

/**
 * A match row from a team's point of view: round, date, home, score, away and result. A Champions match
 * gets the light navy background, its badge and its phase under the round.
 */
export function MatchRow({
  match,
  teamId,
  now,
  logos,
  hasVideo = false,
  highlight = false,
  roundLabel,
  champions,
}: {
  match: Match;
  teamId: number;
  now: string;
  logos: Record<number, string | null>;
  hasVideo?: boolean;
  highlight?: boolean;
  /** A cup knockout round ("1/4", "F"), for matches without a league round. */
  roundLabel?: string;
  champions?: ChampionsStage;
}) {
  const outcome = outcomeFor(match, teamId);
  const upcoming = !match.played && match.date >= now;
  return (
    <Link
      href={`/partidos/${match.id}`}
      className={`grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-[14px] border px-3.5 py-3 sm:grid-cols-[44px_110px_minmax(0,1fr)_84px_minmax(0,1fr)_32px] ${
        champions
          ? `bg-champions-soft ${highlight ? "border-accent" : "border-champions-text/30 hover:border-champions-text"}`
          : highlight
            ? "border-accent bg-accent-soft"
            : "border-line-soft hover:border-line hover:bg-canvas"
      }`}
    >
      <span className={`flex flex-col font-display text-[22px] leading-none font-bold ${champions ? "text-champions-text" : "text-muted"}`}>
        {match.round ? `J${match.round}` : (roundLabel ?? "–")}
        {champions?.phase === "Fase liga" && <span className="mt-1 font-sans text-[10px] font-bold tracking-[0.04em] whitespace-nowrap uppercase">F. liga</span>}
      </span>
      <span className="flex flex-col items-start gap-1 text-[13px] text-muted max-sm:hidden">
        <span className="flex items-center gap-1.5">
          {upcoming ? relativeDay(match.date, now) : formatShortDate(match.date)} · {match.date.slice(11, 16)}
          {hasVideo && (
            <svg width="13" height="13" viewBox="0 0 24 24" className="fill-accent-text" role="img" aria-label="Con vídeo">
              <path d="M7 4l13 8-13 8z" />
            </svg>
          )}
        </span>
        {champions && <ChampionsBadge />}
      </span>
      <span className="flex items-center justify-end gap-2.5 text-right max-sm:hidden">
        <span className={match.homeId === teamId ? "font-bold" : ""}>{match.homeName}</span>
        <Crest src={logos[match.homeId]} name={match.homeName} size={30} />
      </span>
      <span className="text-sm sm:hidden">
        {match.homeName} – {match.awayName}
        {champions && <ChampionsBadge className="ml-1.5 align-[-1px]" />}
      </span>
      <span
        className={`rounded-[10px] text-center font-display text-2xl font-extrabold ${
          match.played ? "bg-canvas" : highlight ? "bg-accent text-on-accent" : "bg-canvas text-muted"
        }`}
      >
        {match.played ? `${match.homeGoals}–${match.awayGoals}` : resultOverdue(match.date, now) ? "S/R" : match.date.slice(11, 16)}
      </span>
      <span className="flex items-center gap-2.5 max-sm:hidden">
        <Crest src={logos[match.awayId]} name={match.awayName} size={30} />
        <span className={match.awayId === teamId ? "font-bold" : ""}>{match.awayName}</span>
      </span>
      <span className="max-sm:hidden">{outcome ? <OutcomeBadge outcome={outcome} size={30} /> : null}</span>
    </Link>
  );
}

/** A round in which the team has a bye. */
export function RestRow({ round, date }: { round: number; date: string }) {
  return (
    <div className="grid grid-cols-[44px_1fr] items-center gap-3 rounded-[14px] border border-line-soft bg-canvas px-3.5 py-3 text-sm text-muted">
      <span className="font-display text-[22px] font-bold">J{round}</span>
      <span>Descansa · {formatShortDate(date)}</span>
    </div>
  );
}
