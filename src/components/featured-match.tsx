import Link from "next/link";
import { Crest } from "@/components/crest";
import { FormBadges, OutcomeBadge } from "@/components/form-badges";
import { CardIcon } from "@/components/player-events";
import { calendarUrl } from "@/lib/calendar";
import { sendingOff } from "@/lib/cards";
import { daysBetween, formatShortDate, relativeDay } from "@/lib/dates";
import type { Match, Outcome } from "@/lib/sportspress/types";
import { getVenue, mapsUrl } from "@/lib/sportspress/venues";
import { VenueLink } from "./venue-link";
import { outcomeFor } from "@/lib/standings";
import type { FeaturedTeam } from "@/lib/views/featured";
import { gap, trend } from "@/lib/views/featured-rules";
import type { MatchPageData, TeamSide } from "@/lib/views/match";

const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Logos = Record<number, string | null>;
type Slugs = Record<number, string>;

/** The team's featured match: its last result right after it, its next match's preview as it gets close. */
export function FeaturedHero({ team, logos, slugs, now, teamPath }: { team: FeaturedTeam; logos: Logos; slugs: Slugs; now: string; teamPath: string }) {
  const { featured } = team;
  if (!featured) return <p className="text-sm text-muted">Todavía no hay partidos esta temporada.</p>;
  return team.mode === "result" ? (
    <ResultHero data={featured} team={team} logos={logos} slugs={slugs} now={now} teamPath={teamPath} />
  ) : (
    <PreviewHero data={featured} team={team} logos={logos} slugs={slugs} now={now} />
  );
}

/** One line with the other match: the next one under a result, the last one under a preview. */
export function FeaturedFooter({ team }: { team: FeaturedTeam }) {
  const last = team.lastResults[0];
  if (team.mode === "result" && team.nextMatch) return <NextMatchLine match={team.nextMatch} team={team} />;
  if (team.mode === "preview" && last) return <LastMatchLine match={last} teamId={team.teamId} />;
  return null;
}

const OUTCOME_LABEL: Record<Outcome, string> = { V: "Victoria", E: "Empate", D: "Derrota" };
const OUTCOME_CHIP: Record<Outcome, string> = { V: "bg-ink text-white", E: "bg-line-soft text-ink", D: "bg-loss-soft text-loss" };

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-bold tracking-[0.1em] text-accent-text uppercase">{children}</span>;
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-md px-2 py-1 text-[11px] font-bold tracking-[0.08em] uppercase ${className}`}>{children}</span>;
}

/** One side of the big scoreboard: crest, name and position in the group. */
function Side({ side, isFocus, logos, slugs, form = false }: { side: TeamSide; isFocus: boolean; logos: Logos; slugs: Slugs; form?: boolean }) {
  return (
    <Link href={`/equipos/${slugs[side.id] ?? ""}`} className="flex min-w-0 flex-col items-center gap-2 text-center">
      <Crest
        src={logos[side.id]}
        name={side.name}
        size={72}
        className={isFocus ? "outline-3 outline-offset-2 outline-accent" : ""}
      />
      <span className="text-[15px] leading-tight font-bold [overflow-wrap:break-word] sm:text-[19px]">{side.name}</span>
      {side.standing && (
        <span className="text-[13px] text-muted">
          {side.standing.position}º · {side.standing.points} pts
        </span>
      )}
      {form && side.standing && <FormBadges form={side.standing.form.slice(-3)} size={20} />}
    </Link>
  );
}

function ResultHero({
  data,
  team,
  logos,
  slugs,
  now,
  teamPath,
}: {
  data: MatchPageData;
  team: FeaturedTeam;
  logos: Logos;
  slugs: Slugs;
  now: string;
  teamPath: string;
}) {
  const { match } = data;
  const outcome = outcomeFor(match, team.teamId);
  const venue = getVenue(match.venueId);
  const sides = [data.home, data.away];
  const hasEvents = data.goals.length > 0 || sides.some((s) => sentOff(s).length > 0);
  const mvpTeam = data.mvp ? sides.find((s) => s.id === data.mvp!.teamId) : undefined;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>
          Último partido · {relativeDay(match.date, now)}
          {match.round && ` · Jornada ${match.round}`}
        </Eyebrow>
        <span className="flex gap-1.5">
          <Chip className="bg-ink text-white">Final</Chip>
          {outcome && <Chip className={OUTCOME_CHIP[outcome]}>{OUTCOME_LABEL[outcome]}</Chip>}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5">
        <Side side={data.home} isFocus={data.home.id === team.teamId} logos={logos} slugs={slugs} />
        <div className="text-center">
          <Link href={`/partidos/${match.id}`} className="block font-display text-[56px] leading-[0.88] font-extrabold sm:text-[104px]">
            {match.homeGoals}
            <span className="px-1.5 text-line sm:px-2.5">–</span>
            {match.awayGoals}
          </Link>
          <div className="mx-auto mt-1.5 max-w-36 text-[13px] text-muted sm:max-w-60">
            {data.halftime && `Descanso ${data.halftime}`}
            {data.halftime && venue && " · "}
            {venue && <VenueLink venue={venue} />}
          </div>
        </div>
        <Side side={data.away} isFocus={data.away.id === team.teamId} logos={logos} slugs={slugs} />
      </div>

      {hasEvents && (
        <div className="grid grid-cols-2 gap-x-4 border-y border-line-soft py-3.5 text-[13px] sm:gap-x-8 sm:text-sm">
          {sides.map((side, index) => (
            <div key={side.id} className={`flex flex-col gap-1.5 ${index === 0 ? "items-end text-right" : ""}`}>
              {goalsByPlayer(data, side.id).map(({ name, minutes }) => (
                <span key={name} className="flex items-start gap-1.5">
                  {index === 1 && <BallIcon />}
                  <span>
                    {name} <b className="whitespace-nowrap">{minutes.map((m) => `${m}′`).join(", ")}</b>
                  </span>
                  {index === 0 && <BallIcon />}
                </span>
              ))}
              {sentOff(side).map(({ player, how }) => (
                <span key={player.playerId} className="flex items-start gap-1.5">
                  {index === 1 && <SendingOffIcon how={how} />}
                  <span>
                    {player.name} <span className="text-muted">({how})</span>
                  </span>
                  {index === 0 && <SendingOffIcon how={how} />}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        {data.mvp && (
          <Tile label="MVP del partido" value={data.mvp.name} detail={mvpDetail(data.mvp.goals, mvpTeam?.name)} />
        )}
        {team.row && <Tile label="En el grupo" value={trend(team.row.position, team.previousPosition)} detail={gap(team.standings, team.row)} />}
        {team.mvpLeader && (
          <Tile label="Más puntos MVP" value={team.mvpLeader.name} detail={`${decimal.format(team.mvpLeader.points)} en la temporada`} />
        )}
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Link href={`/partidos/${match.id}`} className="rounded-full bg-ink px-4.5 py-3 text-sm font-semibold text-white">
          {match.video ? "Ver el resumen y el partido" : "Ver el partido"}
        </Link>
        <Link href={`${teamPath}/partidos`} className="rounded-full border border-line px-4.5 py-3 text-sm font-semibold hover:border-ink">
          Todos los partidos
        </Link>
      </div>
    </>
  );
}

function PreviewHero({ data, team, logos, slugs, now }: { data: MatchPageData; team: FeaturedTeam; logos: Logos; slugs: Slugs; now: string }) {
  const { match, home, away } = data;
  const venue = getVenue(match.venueId);
  const today = daysBetween(now, match.date) === 0;
  const rows =
    home.standing && away.standing
      ? [
          { label: "Puntos", home: home.standing.points, away: away.standing.points },
          { label: "Goles a favor", home: home.standing.goalsFor, away: away.standing.goalsFor },
          { label: "Goles en contra", home: home.standing.goalsAgainst, away: away.standing.goalsAgainst },
        ]
      : [];
  const watch = (side: TeamSide) => {
    const player = side.keyPlayers[0];
    return player && player.goals > 0 ? `${player.name} · ${player.goals}` : "—";
  };
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>
          Próximo partido
          {match.round && ` · Jornada ${match.round}`}
        </Eyebrow>
        <Chip className={today ? "bg-accent text-on-accent" : "bg-accent-soft text-accent-text"}>{today ? "Hoy" : "Previa"}</Chip>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5">
        <Side side={home} isFocus={home.id === team.teamId} logos={logos} slugs={slugs} form />
        <div className="text-center">
          <Link href={`/partidos/${match.id}`} className="block">
            <div className="text-[13px] font-semibold tracking-[0.04em] text-muted uppercase">{relativeDay(match.date, now)}</div>
            <div className="font-display text-[48px] leading-[0.9] font-extrabold sm:text-[104px]">{match.date.slice(11, 16)}</div>
          </Link>
          {venue && (
            <div className="mx-auto mt-1.5 max-w-36 text-[13px] text-muted sm:max-w-60">
              <VenueLink venue={venue} />
            </div>
          )}
        </div>
        <Side side={away} isFocus={away.id === team.teamId} logos={logos} slugs={slugs} form />
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)_130px_minmax(0,1fr)] border-y border-line-soft py-3 text-center text-sm sm:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)]">
          {rows.map((row) => (
            <Comparison key={row.label} label={row.label} home={String(row.home)} away={String(row.away)} bold />
          ))}
          <Comparison label="A seguir" home={watch(home)} away={watch(away)} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {venue?.address && <span className="flex-[1_1_240px] text-sm text-muted">{venue.address}</span>}
        <Link href={`/partidos/${match.id}`} className="rounded-full bg-ink px-4.5 py-3 text-sm font-semibold text-white">
          Ver la previa
        </Link>
        {venue && (
          <a href={mapsUrl(venue)} className="rounded-full border border-line px-4.5 py-3 text-sm font-semibold hover:border-ink">
            Cómo llegar
          </a>
        )}
        <a
          href={calendarUrl(match, venue ? (venue.address ? `${venue.name}, ${venue.address}` : venue.name) : "")}
          className="rounded-full border border-line px-4.5 py-3 text-sm font-semibold hover:border-ink"
        >
          Añadir al calendario
        </a>
      </div>
    </>
  );
}

function Comparison({ label, home, away, bold = false }: { label: string; home: string; away: string; bold?: boolean }) {
  return (
    <>
      <span className={`py-1.5 ${bold ? "font-bold" : ""}`}>{home}</span>
      <span className="py-1.5 text-[13px] text-muted">{label}</span>
      <span className={`py-1.5 ${bold ? "font-bold" : ""}`}>{away}</span>
    </>
  );
}

function NextMatchLine({ match, team }: { match: Match; team: FeaturedTeam }) {
  const venue = getVenue(match.venueId);
  const days = team.daysToNext ?? 0;
  const when = days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`;
  return (
    <Link
      href={`/partidos/${match.id}`}
      className="flex flex-wrap items-center gap-x-4.5 gap-y-1.5 border-t border-line bg-canvas px-5 py-3.5 text-sm hover:bg-line-soft sm:px-7"
    >
      <Eyebrow>Próximo partido</Eyebrow>
      <span className="font-semibold">
        {formatShortDate(match.date)} · {match.date.slice(11, 16)}
      </span>
      <span className="flex-[1_1_220px]">
        {match.homeName} – {match.awayName}
        {team.nextOpponent && <span className="text-muted"> ({team.nextOpponent.position}º · {team.nextOpponent.points} pts)</span>}
      </span>
      <span className="text-[13px] text-muted">
        {[match.round && `J${match.round}`, venue?.name, when].filter(Boolean).join(" · ")}
      </span>
    </Link>
  );
}

function LastMatchLine({ match, teamId }: { match: Match; teamId: number }) {
  const outcome = outcomeFor(match, teamId);
  return (
    <Link
      href={`/partidos/${match.id}`}
      className="flex flex-wrap items-center gap-x-4.5 gap-y-1.5 border-t border-line bg-canvas px-5 py-3.5 text-sm hover:bg-line-soft sm:px-7"
    >
      <span className="text-xs font-bold tracking-[0.1em] text-muted uppercase">Último partido</span>
      <span className="font-semibold">
        {formatShortDate(match.date)}
        {match.round && ` · J${match.round}`}
      </span>
      <span className="flex flex-[1_1_220px] items-center gap-2">
        {match.homeName} <b>{match.homeGoals}–{match.awayGoals}</b> {match.awayName}
        {outcome && <OutcomeBadge outcome={outcome} size={20} />}
      </span>
    </Link>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string | null }) {
  return (
    <div className="rounded-[14px] bg-canvas px-3.5 py-3">
      <div className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{label}</div>
      <div className="mt-1 truncate text-[15px] font-bold">{value}</div>
      {detail && <div className="text-[13px] text-muted">{detail}</div>}
    </div>
  );
}

function BallIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-label="Gol" role="img" className="mt-[3px] shrink-0">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5l4 2.9-1.5 4.8h-5L8 10.4z" fill="currentColor" />
    </svg>
  );
}

function SendingOffIcon({ how }: { how: string }) {
  return (
    <span className="mx-0.5 mt-[3px] inline-flex">
      <CardIcon kind={how === "doble amarilla" ? "second-yellow" : "red"} />
    </span>
  );
}

/** Players sent off, with a straight red or a second yellow. */
function sentOff(side: TeamSide) {
  return side.lineup.flatMap((player) => {
    const how = sendingOff(player.yellowCards, player.redCards);
    return how ? [{ player, how }] : [];
  });
}

function goalsByPlayer(data: MatchPageData, teamId: number) {
  const byPlayer = new Map<string, number[]>();
  for (const goal of data.goals) {
    if (goal.teamId !== teamId) continue;
    byPlayer.set(goal.playerName, [...(byPlayer.get(goal.playerName) ?? []), goal.minute]);
  }
  return [...byPlayer].map(([name, minutes]) => ({ name, minutes }));
}

function mvpDetail(goals: number, team: string | undefined) {
  const parts = [team, goals > 0 && `${goals} ${goals === 1 ? "gol" : "goles"}`].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
