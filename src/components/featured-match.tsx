import Link from "next/link";
import { ChampionsBadge, ChampionsRoad } from "@/components/champions";
import { Crest } from "@/components/crest";
import { FormBadges, OutcomeBadge } from "@/components/form-badges";
import { CardIcon } from "@/components/player-events";
import { calendarUrl } from "@/lib/calendar";
import { sendingOff } from "@/lib/cards";
import { daysBetween, formatShortDate, relativeDay } from "@/lib/dates";
import { fitFontSize } from "@/lib/text";
import { playerDisplayName } from "@/lib/players";
import { championsStageLabel, type ChampionsStage } from "@/lib/sportspress/champions";
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

/** The classes for the box around `FeaturedHero`: the navy night when the featured match is a Champions match. */
export function featuredSurface(team: FeaturedTeam): string {
  return team.featured?.champions ? "champions-night" : "";
}

/** "Champions · Fase liga · Jornada 1" for a Champions match, "Jornada 4" for a league one. */
function roundTitle(match: Match, champions: ChampionsStage | null): string | null {
  if (champions) return `Champions · ${championsStageLabel(champions)}`;
  return match.round ? `Jornada ${match.round}` : null;
}

/** One line with the other match: the next one under a result, the last one under a preview. */
export function FeaturedFooter({ team }: { team: FeaturedTeam }) {
  const last = team.lastResults[0];
  if (team.mode === "result" && team.nextMatch) return <NextMatchLine match={team.nextMatch} team={team} />;
  if (team.mode === "preview" && last) return <LastMatchLine match={last} teamId={team.teamId} champions={last.id in team.champions} />;
  return null;
}

const OUTCOME_LABEL: Record<Outcome, string> = { V: "Victoria", E: "Empate", D: "Derrota" };
const OUTCOME_CHIP: Record<Outcome, string> = { V: "bg-ink text-surface", E: "bg-line-soft text-ink", D: "bg-loss-soft text-loss" };

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-bold tracking-[0.1em] text-accent-text uppercase">{children}</span>;
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-md px-2 py-1 text-[11px] font-bold tracking-[0.08em] uppercase ${className}`}>{children}</span>;
}

/**
 * The big scoreboard. On a phone, crests and score share the first row, so a name on two lines does not push its
 * crest up; from `sm` each side is a single block centred next to the score.
 */
function Scoreboard({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-3 gap-y-2 sm:items-center sm:gap-5">{children}</div>;
}

/** One side of the big scoreboard: crest, name and position in the group. */
function Side({ side, isFocus, logos, slugs, form = false }: { side: TeamSide; isFocus: boolean; logos: Logos; slugs: Slugs; form?: boolean }) {
  return (
    <Link
      href={`/equipos/${slugs[side.id] ?? ""}`}
      className="row-span-2 grid min-w-0 grid-rows-subgrid justify-items-center text-center sm:row-span-1 sm:flex sm:flex-col sm:items-center sm:gap-2"
    >
      <Crest
        src={logos[side.id]}
        name={side.name}
        size={72}
        className={`self-center ${isFocus ? "outline-3 outline-offset-2 outline-accent" : ""}`}
      />
      {/* Full width so the name can fit it; a container (the subgrid item itself cannot be one). */}
      <span className="@container flex w-full min-w-0 flex-col items-center gap-2">
        {/* Its usual size, smaller only when the longest word would not fit the column. */}
        <span
          className="max-w-full leading-tight font-bold [overflow-wrap:break-word] [--base:15px] [--min:11px] sm:[--base:19px]"
          style={{ fontSize: fitFontSize(side.name, 0.62) }}
        >
          {side.name}
        </span>
        {side.standing && (
          <span className="text-[13px] text-muted">
            {side.standing.position}º · {side.standing.points} pts
          </span>
        )}
        {form && side.standing && <FormBadges form={side.standing.form.slice(-3)} size={20} />}
      </span>
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
        <Eyebrow>{["Último partido", relativeDay(match.date, now), roundTitle(match, data.champions)].filter(Boolean).join(" · ")}</Eyebrow>
        <span className="flex gap-1.5">
          <Chip className="bg-ink text-surface">Final</Chip>
          {outcome && <Chip className={OUTCOME_CHIP[outcome]}>{OUTCOME_LABEL[outcome]}</Chip>}
        </span>
      </div>

      <Scoreboard>
        <Side side={data.home} isFocus={data.home.id === team.teamId} logos={logos} slugs={slugs} />
        <div className="row-span-2 grid grid-rows-subgrid text-center sm:row-span-1 sm:block">
          <div className="self-center">
            {venue && (
              <div className="mx-auto mb-1.5 max-w-36 text-[13px] text-muted sm:max-w-60">
                <VenueLink venue={venue} />
              </div>
            )}
            <Link
              href={`/partidos/${match.id}`}
              className={`block font-display leading-[0.88] font-extrabold ${
                Math.max(match.homeGoals!, match.awayGoals!) >= 10 ? "text-[42px] sm:text-[80px]" : "text-[56px] sm:text-[104px]"
              }`}
            >
              {match.homeGoals}
              <span className="px-1.5 text-line sm:px-2.5">–</span>
              {match.awayGoals}
            </Link>
          </div>
          {data.halftime && <div className="text-[13px] text-muted sm:mt-1.5">Descanso {data.halftime}</div>}
        </div>
        <Side side={data.away} isFocus={data.away.id === team.teamId} logos={logos} slugs={slugs} />
      </Scoreboard>

      {data.champions && <ChampionsRoad stage={data.champions} />}

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
                    {playerDisplayName(player.name, player.number)} <span className="text-muted">({how})</span>
                  </span>
                  {index === 0 && <SendingOffIcon how={how} />}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      <Tiles>
        {data.mvp && (
          <Tile label="MVP del partido" value={playerDisplayName(data.mvp.name, data.mvp.number)} detail={mvpDetail(data.mvp.goals, mvpTeam?.name)} />
        )}
        {team.row && <Tile label="En el grupo" value={trend(team.row.position, team.previousPosition)} detail={gap(team.standings, team.row)} />}
        {team.mvpLeader && (
          <Tile label="Mejor valoración" value={team.mvpLeader.name} detail={`${decimal.format(team.mvpLeader.points)} ${data.champions ? "en la Champions" : "en la temporada"}`} />
        )}
      </Tiles>

      <div className="mt-auto flex flex-wrap gap-2.5 border-t border-line-soft pt-5">
        <Link href={`/partidos/${match.id}`} className="rounded-full bg-ink px-4.5 py-3 text-sm font-semibold text-surface">
          Ver el partido
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
  // Played on an earlier day, but the league has not published the score yet.
  const awaiting = daysBetween(now, match.date) < 0;
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
    // Non-breaking spaces keep the goals with the last word of the name when it wraps.
    return player && player.goals > 0 ? `${playerDisplayName(player.name, player.number)}\u00a0·\u00a0${player.goals}` : "—";
  };
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* A Champions match names its phase instead: the chip already says it is the preview. */}
        <Eyebrow>{data.champions ? roundTitle(match, data.champions) : [!awaiting && "Próximo partido", roundTitle(match, null)].filter(Boolean).join(" · ")}</Eyebrow>
        <Chip
          className={
            awaiting
              ? "bg-line-soft text-muted"
              : data.champions
                ? "bg-champions-star text-champions-deep"
                : today
                  ? "bg-accent text-on-accent"
                  : "bg-accent-soft text-accent-text"
          }
        >
          {awaiting ? "Sin resultado" : today ? "Hoy" : "Previa"}
        </Chip>
      </div>

      <Scoreboard>
        <Side side={home} isFocus={home.id === team.teamId} logos={logos} slugs={slugs} form />
        <div className="self-center text-center">
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
      </Scoreboard>

      {data.champions && <ChampionsRoad stage={data.champions} />}

      {rows.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)_130px_minmax(0,1fr)] border-y border-line-soft py-3 text-center text-sm sm:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)]">
          {rows.map((row) => (
            <Comparison key={row.label} label={row.label} home={String(row.home)} away={String(row.away)} bold />
          ))}
          {/* Nobody to watch before anyone has scored in the competition. */}
          {(home.keyPlayers[0]?.goals ?? 0) + (away.keyPlayers[0]?.goals ?? 0) > 0 && <Comparison label="A seguir" home={watch(home)} away={watch(away)} />}
        </div>
      )}

      <Tiles>
        <Tile label="Cara a cara" {...headToHeadTile(data, team.teamId)} />
        {team.mvpLeader && (
          <Tile label="Mejor valoración" value={team.mvpLeader.name} detail={`${decimal.format(team.mvpLeader.points)} ${data.champions ? "en la Champions" : "en la temporada"}`} />
        )}
      </Tiles>

      <div className="mt-auto flex items-center gap-2.5 border-t border-line-soft pt-5 sm:flex-wrap">
        {venue?.address && <span className="hidden flex-[1_1_240px] text-sm text-muted sm:block">{venue.address}</span>}
        <Link href={`/partidos/${match.id}`} className="rounded-full bg-ink px-4.5 py-3 text-sm font-semibold text-surface">
          {awaiting ? "Ver el partido" : "Ver la previa"}
        </Link>
        {!awaiting && (
          <span className="ml-auto flex gap-2 sm:ml-0 sm:gap-2.5">
            {venue && (
              <IconButton href={mapsUrl(venue)} label="Cómo llegar">
                <PinIcon />
              </IconButton>
            )}
            <IconButton
              href={calendarUrl(match, venue ? (venue.address ? `${venue.name}, ${venue.address}` : venue.name) : "")}
              label="Añadir al calendario"
            >
              <CalendarIcon />
            </IconButton>
          </span>
        )}
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
      className="flex flex-wrap items-center gap-x-4.5 gap-y-1.5 border-t border-line bg-canvas px-4 py-3.5 text-sm hover:bg-line-soft sm:px-7"
    >
      <Eyebrow>Próximo partido</Eyebrow>
      <span className="font-semibold">
        {formatShortDate(match.date)} · {match.date.slice(11, 16)}
      </span>
      <span className="flex-[1_1_220px]">
        {match.homeName} – {match.awayName}
        {team.nextOpponent && <span className="text-muted"> ({team.nextOpponent.position}º · {team.nextOpponent.points} pts)</span>}
        {match.id in team.champions && <ChampionsBadge className="ml-2 align-[-1px]" />}
      </span>
      <span className="text-[13px] text-muted">
        {[match.round && `J${match.round}`, venue?.name, when].filter(Boolean).join(" · ")}
      </span>
    </Link>
  );
}

function LastMatchLine({ match, teamId, champions }: { match: Match; teamId: number; champions: boolean }) {
  const outcome = outcomeFor(match, teamId);
  return (
    <Link
      href={`/partidos/${match.id}`}
      className="flex flex-wrap items-center gap-x-4.5 gap-y-1.5 border-t border-line bg-canvas px-4 py-3.5 text-sm hover:bg-line-soft sm:px-7"
    >
      <span className="text-xs font-bold tracking-[0.1em] text-muted uppercase">Último partido</span>
      <span className="font-semibold">
        {formatShortDate(match.date)}
        {match.round && ` · J${match.round}`}
      </span>
      <span className="flex flex-[1_1_220px] items-center gap-2">
        {match.homeName} <b>{match.homeGoals}–{match.awayGoals}</b> {match.awayName}
        {outcome && <OutcomeBadge outcome={outcome} size={20} />}
        {champions && <ChampionsBadge />}
      </span>
    </Link>
  );
}

/** Two columns on a phone, with an odd last tile across both so none is left alone; a single row from `sm`. */
function Tiles({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] [&>:last-child:nth-child(odd)]:col-span-2 sm:[&>:last-child:nth-child(odd)]:col-span-1">
      {children}
    </div>
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

/** A small round button with only its icon on a phone, its label from `sm`. */
function IconButton({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="grid size-11 place-items-center rounded-full border border-line hover:border-ink sm:block sm:size-auto sm:px-4.5 sm:py-3 sm:text-sm sm:font-semibold"
    >
      <span className="sm:hidden">{children}</span>
      <span className="max-sm:sr-only">{label}</span>
    </a>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
    </svg>
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

/** The team's record against the opponent, and how their last meeting ended. */
function headToHeadTile({ headToHead, match }: MatchPageData, teamId: number) {
  const last = headToHead.matches[0];
  if (!last) return { value: "Primer duelo", detail: "Nunca se han enfrentado" };
  const isHome = match.homeId === teamId;
  const record = [
    [isHome ? headToHead.homeWins : headToHead.awayWins, "V"],
    [headToHead.draws, "E"],
    [isHome ? headToHead.awayWins : headToHead.homeWins, "D"],
  ];
  return {
    value: record.map(([count, label]) => `${count}${label}`).join(" · "),
    detail: `Último: ${last.homeName} ${last.homeGoals}–${last.awayGoals} ${last.awayName}`,
  };
}

function mvpDetail(goals: number, team: string | undefined) {
  const parts = [team, goals > 0 && `${goals} ${goals === 1 ? "gol" : "goles"}`].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
