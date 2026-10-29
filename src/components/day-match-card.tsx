import Link from "next/link";
import { ChampionsStar } from "@/components/champions";
import { Crest } from "@/components/crest";
import type { DayMatch } from "@/lib/views/day";

type Logos = Record<number, string | null>;

/**
 * A match of the day: time, venue, both teams with their position or goals, and the group.
 * The match link stretches over the whole card; the venue link sits above it. A Champions match is navy,
 * with the focus team's coral border kept.
 */
export function DayMatchCard({ match, logos, className = "" }: { match: DayMatch; logos: Logos; className?: string }) {
  return (
    <div
      className={`relative flex flex-col gap-2 rounded-2xl border px-3.5 py-3 ${
        match.champions
          ? `champions-night ${match.isFocus ? "border-accent" : "border-champions hover:border-champions-star"}`
          : match.isFocus
            ? "border-accent bg-accent-soft"
            : "border-line bg-surface hover:border-ink"
      } ${className}`}
    >
      <span className="flex justify-between gap-2 text-xs">
        <span className="shrink-0 whitespace-nowrap">
          <b className="text-accent-text">{match.time}</b>
          {match.noResult && (
            <span className="text-muted" title="Jugado sin resultado publicado">
              {" "}
              · S/R
            </span>
          )}
        </span>
        {match.venueId ? (
          <Link href={`/campos/${match.venueId}`} className="relative z-10 truncate text-muted hover:text-ink hover:underline">
            {match.venue}
          </Link>
        ) : (
          <span className="truncate text-muted">{match.venue}</span>
        )}
      </span>
      <Link href={`/partidos/${match.id}`} className="flex flex-col gap-2 after:absolute after:inset-0 after:rounded-2xl">
        {/* A past match without a score shows no positions, which would read as an upcoming one. */}
        <DayTeam id={match.homeId} name={match.home} position={match.noResult ? null : match.homePosition} goals={match.homeGoals} logos={logos} />
        <DayTeam id={match.awayId} name={match.away} position={match.noResult ? null : match.awayPosition} goals={match.awayGoals} logos={logos} />
      </Link>
      {match.champions ? (
        <span className="flex items-center gap-1.5 border-t border-line-soft pt-2 text-xs text-muted">
          <ChampionsStar className="text-champions-star" />
          <span className="truncate">{["Champions", match.label].filter(Boolean).join(" · ")}</span>
        </span>
      ) : (
        match.label && <span className="border-t border-line-soft pt-2 text-xs text-muted">{match.label}</span>
      )}
    </div>
  );
}

function DayTeam({ id, name, position, goals, logos }: { id: number; name: string; position: number | null; goals: number | null; logos: Logos }) {
  return (
    <span className="flex items-center gap-2 text-sm font-medium">
      <Crest src={logos[id]} name={name} size={24} />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {goals !== null ? <b className="font-display text-lg">{goals}</b> : position && <span className="text-xs text-muted">{position}º</span>}
    </span>
  );
}
