import Link from "next/link";
import { Crest } from "@/components/crest";
import type { DayMatch } from "@/lib/views/day";

type Logos = Record<number, string | null>;

/** A match of the day: time, venue, both teams with their position or goals, and the group. */
export function DayMatchCard({ match, logos, className = "" }: { match: DayMatch; logos: Logos; className?: string }) {
  return (
    <Link
      href={`/partidos/${match.id}`}
      className={`flex flex-col gap-2 rounded-2xl border px-3.5 py-3 ${
        match.isFocus ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-ink"
      } ${className}`}
    >
      <span className="flex justify-between gap-2 text-xs">
        <b className="text-accent-text">{match.time}</b>
        <span className="truncate text-muted">{match.venue}</span>
      </span>
      <DayTeam id={match.homeId} name={match.home} position={match.homePosition} goals={match.homeGoals} logos={logos} />
      <DayTeam id={match.awayId} name={match.away} position={match.awayPosition} goals={match.awayGoals} logos={logos} />
      {match.label && <span className="border-t border-line-soft pt-2 text-xs text-muted">{match.label}</span>}
    </Link>
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
