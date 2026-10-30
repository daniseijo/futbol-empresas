import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChampionsRoad, ChampionsStar } from "@/components/champions";
import { Crest } from "@/components/crest";
import { FormBadges, OutcomeBadge } from "@/components/form-badges";
import { MatchTimeline } from "@/components/match-timeline";
import { PhotoGallery } from "@/components/photo-gallery";
import { PlayerAvatar } from "@/components/player-avatar";
import { PlayerEvents, PlayerEventsLegend } from "@/components/player-events";
import { ShareButton } from "@/components/share-button";
import { VenueLink } from "@/components/venue-link";
import { VenueMap } from "@/components/venue-map";
import { VideoEmbed } from "@/components/video-embed";
import { siteConfig } from "@/config/site";
import { calendarUrl } from "@/lib/calendar";
import { getSeasonMatches, getCurrentSeason, getTeam } from "@/lib/data";
import { playerDisplayName } from "@/lib/players";
import { capitalize, formatLongDate, formatShortDate, relativeDay, resultOverdue } from "@/lib/dates";
import { championsStageLabel } from "@/lib/sportspress/champions";
import { slugify } from "@/lib/sportspress/leagues";
import type { Position } from "@/lib/sportspress/types";
import { getVenue, mapsUrl } from "@/lib/sportspress/venues";
import { outcomeFor } from "@/lib/standings";
import { fitFontSize } from "@/lib/text";
import { getMatchPageData, matchSummary, type MatchPageData, type TeamSide } from "@/lib/views/match";

const decimal = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

/** The build generates the focus team's matches; the rest, on first visit. */
export async function generateStaticParams() {
  const [team, season] = await Promise.all([getTeam(siteConfig.focusTeamSlug), getCurrentSeason()]);
  const matches = season ? await getSeasonMatches(season.id) : [];
  const own = team ? matches.filter((m) => m.homeId === team.id || m.awayId === team.id) : [];
  return (own.length > 0 ? own : matches.slice(0, 1)).map((m) => ({ id: String(m.id) }));
}

export async function generateMetadata({ params }: PageProps<"/partidos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = Number.isInteger(Number(id)) ? await getMatchPageData(Number(id)) : null;
  if (!data) return { title: "Partido" };
  const { match } = data;
  const score = match.played ? ` ${match.homeGoals}–${match.awayGoals} ` : " – ";
  const when = match.played ? "" : `${capitalize(formatLongDate(match.date, data.now))}, ${match.date.slice(11, 16)} · `;
  return { title: `${data.home.name}${score}${data.away.name}`, description: when + matchSummary(data) };
}

export default function MatchPage({ params }: PageProps<"/partidos/[id]">) {
  return (
    <Suspense fallback={<MatchSkeleton />}>
      <MatchContent params={params} />
    </Suspense>
  );
}

function MatchSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-7 sm:px-6" aria-busy="true">
      <div className="h-72 animate-pulse rounded-3xl bg-line" />
      <div className="mt-6 h-96 animate-pulse rounded-3xl bg-line" />
    </div>
  );
}

async function MatchContent({ params }: Pick<PageProps<"/partidos/[id]">, "params">) {
  const { id } = await params;
  const data = Number.isInteger(Number(id)) ? await getMatchPageData(Number(id)) : null;
  if (!data) notFound();
  const { match } = data;

  return (
    <>
      <Scoreboard data={data} />
      {/* A Champions match's cards keep white, with its blue for the coral (and for the tiles' grey). */}
      <main
        className={`mx-auto flex max-w-7xl flex-wrap gap-6 px-4 pt-6 sm:px-6 ${
          data.champions ? "champions-light [--color-canvas:var(--color-champions-soft)]" : ""
        }`}
      >
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5.5">
          {match.video && (
            <VideoEmbed id={match.video.id} title={match.video.title ?? `${match.homeName} – ${match.awayName}`} />
          )}
          {match.played ? (
            <>
              <Mvp data={data} />
              <Lineups data={data} />
              <Photos data={data} />
            </>
          ) : (
            <>
              <Preview data={data} />
              {data.home.lineup.length + data.away.lineup.length > 0 && <Lineups data={data} />}
            </>
          )}
        </div>
        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5.5">
          {match.played && <Stats data={data} />}
          <VenueCard data={data} />
          <HeadToHead data={data} />
          <RestOfRound data={data} />
        </aside>
      </main>
    </>
  );
}

// --- Header -----------------------------------------------------------------------

/** A side's scorers, one line each with all their minutes: "Javier Paradinas 21′, 45′". */
function scorersOf(data: MatchPageData, teamId: number) {
  const byPlayer = new Map<string, number[]>();
  for (const goal of data.goals) {
    if (goal.teamId === teamId) byPlayer.set(goal.playerName, [...(byPlayer.get(goal.playerName) ?? []), goal.minute]);
  }
  return [...byPlayer].map(([name, minutes]) => ({ name, minutes }));
}

/**
 * One side of the scoreboard. On phones it takes two rows of the scoreboard's
 * grid (subgrid): crests share the first and names the second, so a name on
 * two lines does not push its crest below the other one. From `sm` up it is a
 * column (crest, name, position) centred like the home page's scoreboard, and
 * the columns align to the top, which keeps the crests in line too. A two-digit
 * score leaves no room for the full crest on a phone, so it is drawn smaller
 * then.
 */
function TeamLink({ side, smallCrest }: { side: TeamSide; smallCrest: boolean }) {
  const content = (
    <>
      <Crest src={side.logoUrl} name={side.name} size={96} className={`max-sm:self-center ${smallCrest ? "max-sm:size-18!" : ""}`} />
      {/* The container the name fits: this full-width wrapper on phones (a subgrid item cannot be one), the column from `sm`. */}
      <span className="@container flex w-full min-w-0 flex-col gap-3 sm:contents">
        <span
          // Its usual size, smaller only when the longest word would not fit the column.
          className="font-display leading-none font-extrabold text-balance [overflow-wrap:break-word] uppercase [--base:26px] [--min:15px] sm:[--base:44px] sm:[--min:24px]"
          style={{ fontSize: fitFontSize(side.name, 0.46) }}
        >
          {side.name}
        </span>
        {side.standing && (
          <span className="text-[13px] text-muted max-sm:hidden">
            {side.standing.position}º · {side.standing.points} pts
          </span>
        )}
      </span>
    </>
  );
  const className =
    "row-span-2 grid min-w-0 grid-rows-subgrid justify-items-center text-center sm:@container sm:row-span-1 sm:flex sm:flex-col sm:items-center sm:gap-3";
  return side.slug ? (
    <Link href={`/equipos/${side.slug}`} className={`${className} hover:opacity-80`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function Scorers({ scorers, className }: { scorers: ReturnType<typeof scorersOf>; className: string }) {
  return (
    // On a phone the side column is narrow: the minutes go on a line of their own so the name is not split for them.
    <ul className={`row-start-3 flex flex-col gap-1.5 text-center text-[13px] leading-snug text-muted sm:row-start-2 sm:gap-0 sm:leading-relaxed ${className}`}>
      {scorers.map(({ name, minutes }) => (
        <li key={name} className="text-balance">
          {name}
          <span className="max-sm:hidden">{"\u00a0"}</span>
          <span className="whitespace-nowrap max-sm:block">{minutes.map((m) => `${m}′`).join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

function Scoreboard({ data }: { data: MatchPageData }) {
  const { match, home, away } = data;
  const venue = getVenue(match.venueId);
  const twoDigits = match.played && Math.max(match.homeGoals!, match.awayGoals!) >= 10;
  const homeScorers = scorersOf(data, match.homeId);
  const awayScorers = scorersOf(data, match.awayId);
  return (
    <section className={`border-b border-line bg-surface ${data.champions ? "champions-night" : ""}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-6 pb-8 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <nav aria-label="Competición" className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {/* The "›" follows each part, so a wrapped line ends with it instead of starting with it. */}
            {data.path.map((part, index) => (
              <span key={part.href} className="flex items-center gap-2">
                <Link
                  href={part.href}
                  className={`hover:text-accent-text hover:underline ${index === data.path.length - 1 ? "font-semibold text-ink" : ""}`}
                >
                  {part.name}
                </Link>
                {index < data.path.length - 1 && <span aria-hidden="true">›</span>}
              </span>
            ))}
            {match.round && (
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-text">Jornada {match.round}</span>
            )}
          </nav>
          <ShareButton title={`${home.name} – ${away.name}`} />
        </div>

        {data.champions && (
          <div className="-mb-2 flex items-center justify-center gap-2.5 text-center text-xs font-extrabold tracking-[0.16em] text-champions-star uppercase max-sm:text-[10px] max-sm:tracking-[0.1em]">
            <ChampionsStar />
            {/* On a phone the crumbs right above already name the competition. */}
            <span>
              <span className="max-sm:hidden">{data.path[0]?.name} · </span>
              {championsStageLabel(data.champions)}
            </span>
            <ChampionsStar />
          </div>
        )}

        {/* Two blocks that never split: on phones one per line, so no line starts with "·". */}
        <div className="flex flex-col items-center text-center text-[13px] text-muted sm:flex-row sm:flex-wrap sm:justify-center">
          <span>
            {capitalize(formatLongDate(match.date, data.now))} · {match.date.slice(11, 16)}
          </span>
          <span>
            <span className="max-sm:hidden">{"\u00a0· "}</span>
            {venue && (
              <>
                <VenueLink venue={venue} /> ·{" "}
              </>
            )}
            2 × 25 min
          </span>
        </div>

        {/* Narrower than the page so centred sides stay near the score on wide screens. */}
        <div className="mx-auto grid w-full max-w-230 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-4 gap-y-3 sm:items-start sm:gap-8">
          <TeamLink side={home} smallCrest={twoDigits} />
          <div className="flex flex-col items-center gap-2 self-center">
            {match.played ? (
              <>
                {/* A two-digit score takes the width the names need on a phone: draw it smaller. */}
                <div
                  className={`font-display leading-[0.9] font-extrabold tracking-tight ${
                    twoDigits ? "text-[52px] sm:text-[96px]" : "text-[72px] sm:text-[120px]"
                  }`}
                >
                  <span className={match.homeGoals! >= match.awayGoals! ? "" : "text-muted"}>{match.homeGoals}</span>
                  <span className="text-line"> – </span>
                  <span className={match.awayGoals! >= match.homeGoals! ? "" : "text-muted"}>{match.awayGoals}</span>
                </div>
                <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-bold tracking-[0.12em] text-surface">FINAL</span>
                {data.halftime && <span className="text-[13px] text-muted">Descanso {data.halftime}</span>}
              </>
            ) : resultOverdue(match.date, data.now) ? (
              // A day after kickoff and the league has not published the score: not an upcoming match.
              <>
                <span className="rounded-full bg-line-soft px-3 py-1 text-xs font-bold tracking-[0.1em] text-muted uppercase">Sin resultado</span>
                <span className="max-w-32 text-center text-[13px] text-muted sm:max-w-none">La liga no lo ha publicado</span>
              </>
            ) : (
              <>
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold tracking-[0.1em] text-on-accent uppercase">
                  {relativeDay(match.date, data.now)}
                </span>
                <div className="font-display text-[56px] leading-none font-extrabold sm:text-[88px]">{match.date.slice(11, 16)}</div>
              </>
            )}
          </div>
          <TeamLink side={away} smallCrest={twoDigits} />
          {/* A last row of the same grid, so each side's scorers sit centred under its name. */}
          {match.played && (
            <>
              <Scorers scorers={homeScorers} className="col-start-1" />
              <Scorers scorers={awayScorers} className="col-start-3" />
            </>
          )}
        </div>

        {data.champions && (
          <div className="flex justify-center">
            <ChampionsRoad stage={data.champions} />
          </div>
        )}

        {match.played && data.goals.length > 0 && (
          <MatchTimeline
            goals={data.goals}
            home={home}
            away={away}
            halftime={data.halftime}
          />
        )}
      </div>
    </section>
  );
}

// --- Body -------------------------------------------------------------------------

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 card px-4 py-5 sm:p-5.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[26px] font-extrabold uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function teamOf(data: MatchPageData, teamId: number) {
  return teamId === data.home.id ? data.home : data.away;
}

/** The league's "Crack": the player of the match. */
function Mvp({ data }: { data: MatchPageData }) {
  const p = data.mvp;
  if (!p) return null;
  const team = teamOf(data, p.teamId);
  const facts = [
    p.goals > 0 && `${p.goals} ${p.goals === 1 ? "gol" : "goles"}`,
    p.assists > 0 && `${p.assists} ${p.assists === 1 ? "asistencia" : "asistencias"}`,
    p.points > 0 && `${decimal.format(p.points)} puntos`,
  ].filter(Boolean);
  return (
    <section className="flex items-center gap-5 rounded-[22px] bg-accent p-5.5 text-on-accent">
      <PlayerAvatar name={p.name} photoUrl={p.photoUrl} number={p.number} position={null} size={84} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs font-extrabold tracking-[0.14em]">MVP DEL PARTIDO</span>
        <Link href={`/jugadores/${p.playerId}`} className="font-display text-[34px] leading-none font-extrabold uppercase hover:underline">
          {playerDisplayName(p.name, p.number)}
        </Link>
        <span className="text-[13px]">{[team.name, ...facts].join(" · ")}</span>
      </div>
      <Crest src={team.logoUrl} name={team.name} size={56} className="max-sm:hidden" />
    </section>
  );
}

const POSITION_ORDER: (Position | null)[] = ["POR", "DEF", "MED", "DEL", null];

function Lineups({ data }: { data: MatchPageData }) {
  return (
    <Card title="Alineaciones">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
        {[data.home, data.away].map((side) => {
          const sorted = POSITION_ORDER.flatMap((position) => side.lineup.filter((p) => p.position === position));
          return (
            <div key={side.id} className="flex flex-col">
              {/* Top-aligned (the name's line is the crest's height) so both columns' crests line up when a name wraps. */}
              <div className="flex items-start gap-2.5 border-b border-line pb-2.5 leading-7">
                <Crest src={side.logoUrl} name={side.name} size={28} />
                <span className="min-w-0 font-bold">{side.name}</span>
                <span className="text-[13px] whitespace-nowrap text-muted">
                  {side.lineup.length} {side.lineup.length === 1 ? "jugador" : "jugadores"}
                </span>
                <span className="ml-auto self-center text-xs text-muted" title="Puntuación que da la liga a cada jugador en el partido">
                  Puntos
                </span>
              </div>
              {sorted.length === 0 && <p className="py-3 text-sm text-muted">Sin alineación publicada.</p>}
              {sorted.map((p) => (
                <Link
                  key={p.playerId}
                  href={`/jugadores/${p.playerId}`}
                  className="grid grid-cols-[40px_1fr_auto_32px] items-center gap-2.5 border-b border-line-soft py-2 hover:bg-canvas"
                >
                  <PlayerAvatar name={p.name} photoUrl={p.photoUrl} number={p.number} position={p.position} size={34} />
                  <span className="min-w-0 text-sm">
                    <span className="font-semibold">{playerDisplayName(p.name, p.number)}</span>{" "}
                    <span className="text-xs whitespace-nowrap text-muted">{[p.position, p.name && p.photoUrl && p.number ? `#${p.number}` : null].filter(Boolean).join(" · ")}</span>
                    {p.crack && (
                      <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent-text">MVP</span>
                    )}
                  </span>
                  {/* Always a cell, even when empty, so the points stay in their column; narrow, so events wrap and the name keeps its room. */}
                  <span className="max-w-36 sm:max-w-48">
                    <PlayerEvents goals={p.goals} minutes={p.minutes} assists={p.assists} yellowCards={p.yellowCards} redCards={p.redCards} />
                  </span>
                  <span className="text-right text-[13px] text-muted">{p.points ? decimal.format(p.points) : ""}</span>
                </Link>
              ))}
              {side.unattributedGoals > 0 && (
                <p className="pt-2 text-xs text-muted">
                  {side.unattributedGoals} {side.unattributedGoals === 1 ? "gol sin autor en el acta" : "goles sin autor en el acta"} (en propia
                  puerta o sin registrar).
                </p>
              )}
            </div>
          );
        })}
      </div>
      <PlayerEventsLegend extra="Puntos: la puntuación que da la liga a cada jugador en el partido" />
    </Card>
  );
}

function Photos({ data }: { data: MatchPageData }) {
  const { match } = data;
  if (match.photos.length === 0) return null;
  return (
    <PhotoGallery
      photos={match.photos.map((url) => ({ url, caption: "" }))}
      alt={`Foto del partido ${match.homeName} – ${match.awayName}`}
      fileName={`${slugify(match.homeName)}-${slugify(match.awayName)}-${match.date.slice(0, 10)}`}
      className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
      tileClassName="h-64 rounded-2xl"
      sizes="(min-width: 640px) 40vw, 100vw"
    />
  );
}

function Preview({ data }: { data: MatchPageData }) {
  const sides = [data.home, data.away];
  return (
    <Card title={!data.match.played && resultOverdue(data.match.date, data.now) ? "Los equipos" : "Previa"}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {sides.map((side) => (
          <div key={side.id} className="flex flex-col gap-3 rounded-2xl bg-canvas p-4">
            <div className="flex items-start gap-2.5 leading-9">
              <Crest src={side.logoUrl} name={side.name} size={36} />
              <b className="min-w-0">{side.name}</b>
            </div>
            {side.standing ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="font-display text-[32px] font-extrabold">{side.standing.position}º</div>
                  <div className="text-xs text-muted">posición</div>
                </div>
                <div>
                  <div className="font-display text-[32px] font-extrabold">{side.standing.points}</div>
                  <div className="text-xs text-muted">puntos</div>
                </div>
                <div>
                  <div className="font-display text-[32px] font-extrabold">
                    {side.standing.goalsFor}–{side.standing.goalsAgainst}
                  </div>
                  <div className="text-xs text-muted">goles</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Sin partidos jugados en el grupo.</p>
            )}
            {side.standing && side.standing.form.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Últimos resultados</span>
                <FormBadges form={side.standing.form} />
              </div>
            )}
            {side.keyPlayers.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-line pt-3">
                <span className="text-xs font-bold tracking-[0.1em] text-muted">A SEGUIR</span>
                {side.keyPlayers.map((p) => (
                  <Link key={p.id} href={`/jugadores/${p.id}`} className="flex items-center gap-2.5 text-sm hover:text-accent-text">
                    <PlayerAvatar name={p.name} photoUrl={p.photoUrl} number={p.number} position={p.position} size={32} />
                    <span className="flex-1 font-semibold">{playerDisplayName(p.name, p.number)}</span>
                    <span className="text-muted">
                      {p.goals > 0 ? `${p.goals} ${p.goals === 1 ? "gol" : "goles"}` : `${decimal.format(p.mvpPoints)} pts`}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// --- Sidebar ----------------------------------------------------------------------

function Stats({ data }: { data: MatchPageData }) {
  const rows = [
    { label: "Goles", h: data.match.homeGoals ?? 0, a: data.match.awayGoals ?? 0 },
    { label: "Asistencias", h: data.home.stats.assists, a: data.away.stats.assists },
    { label: "Amarillas", h: data.home.stats.yellowCards, a: data.away.stats.yellowCards },
    { label: "Rojas", h: data.home.stats.redCards, a: data.away.stats.redCards },
    { label: "Jugadores", h: data.home.stats.players, a: data.away.stats.players },
    { label: "Puntos de equipo", h: data.home.stats.points, a: data.away.stats.points },
  ];
  return (
    <Card title="Estadísticas">
      {rows.map((row) => {
        const max = Math.max(row.h, row.a) || 1;
        return (
          <div key={row.label} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <b>{decimal.format(row.h)}</b>
              <span className="text-muted">{row.label}</span>
              <b>{decimal.format(row.a)}</b>
            </div>
            <div className="flex h-1.5 gap-1">
              <div className="flex flex-1 justify-end rounded-full bg-line-soft">
                <div className="rounded-full bg-accent" style={{ width: `${(row.h / max) * 100}%` }} />
              </div>
              <div className="flex-1 rounded-full bg-line-soft">
                <div className="h-1.5 rounded-full bg-ink" style={{ width: `${(row.a / max) * 100}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function VenueCard({ data }: { data: MatchPageData }) {
  const venue = getVenue(data.match.venueId);
  if (!venue) return null;
  const location = venue.address ? `${venue.name}, ${venue.address}` : venue.name;
  return (
    <Card
      title="El campo"
      action={
        <Link href={`/campos/${venue.id}`} className="text-sm font-semibold text-accent-text hover:underline">
          Ver el campo →
        </Link>
      }
    >
      {venue.lat !== null && venue.lng !== null && (
        <Link href={`/campos/${venue.id}`} aria-label={`Ver ${venue.name}`} className="block transition-opacity hover:opacity-90">
          <VenueMap lat={venue.lat} lng={venue.lng} name={venue.name} className="h-[180px] rounded-[14px]" />
        </Link>
      )}
      <div>
        <VenueLink venue={venue} className="font-semibold" />
        {venue.address && <div className="text-sm text-muted">{venue.address}</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={mapsUrl(venue)} className="rounded-[10px] bg-ink px-4 py-3 text-sm font-semibold text-white">
          Cómo llegar
        </a>
        {!data.match.played && (
          <a href={calendarUrl(data.match, location)} className="rounded-[10px] border border-line px-4 py-3 text-sm font-semibold">
            Añadir al calendario
          </a>
        )}
      </div>
    </Card>
  );
}

function HeadToHead({ data }: { data: MatchPageData }) {
  const { matches, homeWins, draws, awayWins } = data.headToHead;
  if (matches.length === 0) return null;
  return (
    <Card title="Cara a cara">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { v: homeWins, l: `gana ${data.home.name}` },
          { v: draws, l: "empates" },
          { v: awayWins, l: `gana ${data.away.name}` },
        ].map((item) => (
          <div key={item.l} className="rounded-xl bg-canvas p-2.5">
            <div className="font-display text-[28px] font-extrabold">{item.v}</div>
            <div className="text-xs text-muted">{item.l}</div>
          </div>
        ))}
      </div>
      {matches.map((m) => {
        const outcome = outcomeFor(m, data.home.id);
        return (
          <Link key={m.id} href={`/partidos/${m.id}`} className="flex items-center gap-2.5 border-t border-line-soft pt-2.5 text-sm hover:text-accent-text">
            <span className="w-24 text-xs text-muted">{formatShortDate(m.date, data.now)}</span>
            <span className="flex-1 truncate">
              {m.homeName} – {m.awayName}
            </span>
            <b>
              {m.homeGoals}–{m.awayGoals}
            </b>
            {outcome && <OutcomeBadge outcome={outcome} size={24} />}
          </Link>
        );
      })}
    </Card>
  );
}

function RestOfRound({ data }: { data: MatchPageData }) {
  if (data.round.length === 0) return null;
  return (
    <Card
      title={`Resto de la jornada\u00a0${data.match.round}`}
      action={
        data.dayHref && (
          <Link href={data.dayHref} className="text-sm font-semibold whitespace-nowrap text-accent-text hover:underline">
            Todos los del día →
          </Link>
        )
      }
    >
      {data.round.map((m) => (
        <Link
          key={m.id}
          href={`/partidos/${m.id}`}
          className="grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center gap-2 border-t border-line-soft pt-2.5 text-sm hover:text-accent-text"
        >
          <span className="truncate text-right">{m.homeName}</span>
          <span className="text-center font-display text-xl font-bold">
            {m.played ? `${m.homeGoals}–${m.awayGoals}` : resultOverdue(m.date, data.now) ? <span className="text-xs font-semibold text-muted">S/R</span> : m.date.slice(11, 16)}
          </span>
          <span className="truncate">{m.awayName}</span>
        </Link>
      ))}
      {data.restingTeam && <p className="text-sm text-muted">Descansa: {data.restingTeam}</p>}
    </Card>
  );
}
