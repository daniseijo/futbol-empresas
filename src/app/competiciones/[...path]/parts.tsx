import Link from "next/link";
import { Bracket } from "@/components/bracket";
import { Crest } from "@/components/crest";
import { PlayerAvatar } from "@/components/player-avatar";
import { SectionCard } from "@/components/team/section-card";
import { dayKey, formatShortDate, resultOverdue } from "@/lib/dates";
import type { Match } from "@/lib/sportspress/types";
import type { BracketData, CompetitionPageData, GroupData, PlayerTally } from "@/lib/views/competition";

// Pieces of a competition's page, shared with a Champions sector's.

export function BracketCard({ bracket, data }: { bracket: BracketData; data: CompetitionPageData }) {
  const final = bracket.rounds[bracket.rounds.length - 1].ties[0];
  const champion = bracket.championId === final.homeId ? final.homeName : bracket.championId === final.awayId ? final.awayName : null;
  return (
    <SectionCard
      title={bracket.name ?? "Cuadro"}
      aside={
        champion && (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-muted">Campeón</span>
            <Crest src={data.logos[bracket.championId!]} name={champion} size={22} />
            <span className="font-semibold">{champion}</span>
          </span>
        )
      }
    >
      <Bracket bracket={bracket} logos={data.logos} focusTeamId={data.focusTeamId} now={data.now} />
    </SectionCard>
  );
}

export function Rounds({
  group,
  selected,
  roundHref,
  data,
  title,
}: {
  group: GroupData;
  selected: string | null;
  roundHref: (key: string) => string;
  data: CompetitionPageData;
  /** Replaces the round's name as the card title, for matches listed apart from the brackets. */
  title?: string;
}) {
  const index = Math.max(
    0,
    group.rounds.findIndex((r) => r.key === (selected ?? group.currentRound)),
  );
  const round = group.rounds[index];
  if (!round) return null;
  const previous = group.rounds[index - 1];
  const next = group.rounds[index + 1];
  const arrow = "flex size-9 items-center justify-center rounded-full border border-line text-lg";
  return (
    <SectionCard
      title={title ?? round.label}
      aside={
        <span className="flex items-center gap-1.5">
          {previous ? (
            <Link href={roundHref(previous.key)} scroll={false} className={`${arrow} hover:border-ink`} aria-label={previous.label}>
              ‹
            </Link>
          ) : (
            <span className={`${arrow} text-line`} aria-hidden="true">
              ‹
            </span>
          )}
          {next ? (
            <Link href={roundHref(next.key)} scroll={false} className={`${arrow} hover:border-ink`} aria-label={next.label}>
              ›
            </Link>
          ) : (
            <span className={`${arrow} text-line`} aria-hidden="true">
              ›
            </span>
          )}
        </span>
      }
    >
      <p className="text-sm text-muted">
        {title ? round.label : formatShortDate(round.date, data.now)} · {index + 1} de {group.rounds.length}
      </p>
      <div className="flex flex-col">
        {round.matches.map((match) => (
          <RoundMatch key={match.id} match={match} roundDay={dayKey(round.date)} data={data} />
        ))}
      </div>
      {round.resting.length > 0 && <p className="text-sm text-muted">Descansa: {round.resting.join(", ")}.</p>}
    </SectionCard>
  );
}

export function RoundMatch({ match, roundDay, data }: { match: Match; roundDay: string; data: CompetitionPageData }) {
  const focus = match.homeId === data.focusTeamId || match.awayId === data.focusTeamId;
  const pending = !match.played && resultOverdue(match.date, data.now);
  // A match postponed to another day shows the date instead of the time.
  const when = dayKey(match.date) === roundDay ? match.date.slice(11, 16) : formatShortDate(match.date, data.now);
  return (
    <Link
      href={`/partidos/${match.id}`}
      className={`grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center gap-2.5 border-b border-line-soft px-2 py-2.5 ${
        focus ? "rounded-[10px] border-transparent bg-accent-soft" : "hover:bg-canvas"
      }`}
    >
      <span className="flex min-w-0 items-center justify-end gap-2 text-right text-sm">
        <span className={`truncate ${match.played && match.homeGoals! > match.awayGoals! ? "font-bold" : ""}`}>{match.homeName}</span>
        <Crest src={data.logos[match.homeId]} name={match.homeName} size={26} />
      </span>
      <span
        className={`rounded-lg bg-canvas text-center font-display font-extrabold ${match.played ? "text-xl" : "text-base text-muted"}`}
      >
        {match.played ? `${match.homeGoals}–${match.awayGoals}` : pending ? "S/R" : when}
      </span>
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <Crest src={data.logos[match.awayId]} name={match.awayName} size={26} />
        <span className={`truncate ${match.played && match.awayGoals! > match.homeGoals! ? "font-bold" : ""}`}>{match.awayName}</span>
      </span>
    </Link>
  );
}

export function TallyCard({ title, unit, items, note }: { title: string; unit: string; items: PlayerTally[]; note?: string }) {
  return (
    <SectionCard title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Sin datos todavía.</p>
      ) : (
        <div className="flex flex-col">
          {items.map((item, index) => (
            <Link
              key={item.playerId}
              href={`/jugadores/${item.playerId}`}
              className="grid grid-cols-[24px_40px_1fr_auto] items-center gap-2.5 border-t border-line-soft py-2 hover:bg-canvas"
            >
              <span className="text-center text-sm text-muted">{index + 1}</span>
              <PlayerAvatar name={item.name} photoUrl={item.photoUrl} number={null} position={null} size={36} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{item.name}</span>
                <span className="truncate text-xs text-muted">{item.team}</span>
              </span>
              <span className="text-right">
                <span className="font-display text-[26px] font-extrabold">{item.value}</span>
                <span className="sr-only"> {unit}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
      {note && <p className="text-xs text-muted">{note}</p>}
    </SectionCard>
  );
}
