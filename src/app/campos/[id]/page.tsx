import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChampionsBadge } from "@/components/champions";
import { Crest } from "@/components/crest";
import { DayMatchCard } from "@/components/day-match-card";
import { Eyebrow } from "@/components/featured-match";
import { SectionCard } from "@/components/team/section-card";
import { VenueMap } from "@/components/venue-map";
import { siteConfig } from "@/config/site";
import { capitalize, daysBetween, formatLongDate, formatShortDate, relativeDay } from "@/lib/dates";
import { getTeam, getTeams } from "@/lib/data";
import type { Match } from "@/lib/sportspress/types";
import { getVenue, getVenues, mapsUrl } from "@/lib/sportspress/venues";
import { getVenuePageData, type VenuePageData } from "@/lib/views/venue";
import type { DayMatch } from "@/lib/views/day";

type Props = PageProps<"/campos/[id]">;
type Logos = Record<number, string | null>;

export function generateStaticParams() {
  return getVenues().map((venue) => ({ id: String(venue.id) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const venue = Number.isInteger(Number(id)) ? getVenue(Number(id)) : null;
  return { title: venue ? `${venue.name} · Campos` : "Campos" };
}

export default function VenuePage({ params }: Props) {
  return (
    <Suspense fallback={<VenueSkeleton />}>
      <VenueContent params={params} />
    </Suspense>
  );
}

function VenueSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-7 sm:px-6" aria-busy="true">
      <div className="h-24 animate-pulse rounded-[22px] bg-line" />
      <div className="h-72 animate-pulse rounded-[22px] bg-line-soft" />
      <div className="h-96 animate-pulse rounded-[22px] bg-line-soft" />
    </div>
  );
}

async function VenueContent({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const data = Number.isInteger(Number(id)) ? await getVenuePageData(Number(id)) : null;
  if (!data) notFound();
  const [teams, focusTeam] = await Promise.all([getTeams(), getTeam(siteConfig.focusTeamSlug)]);
  const logos: Logos = Object.fromEntries(teams.map((t) => [t.id, t.logoUrl]));
  const focusId = focusTeam?.id ?? null;
  const { venue } = data;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-7 px-4 pt-7 sm:px-6">
      <header className="flex flex-col gap-4">
        <nav aria-label="Migas" className="text-sm font-semibold">
          <Link href="/campos" className="hover:text-accent-text">
            ← Todos los campos
          </Link>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <Eyebrow>Campo</Eyebrow>
            <h1 className="mt-1 font-display text-[40px] leading-none font-extrabold [overflow-wrap:anywhere] uppercase sm:text-[52px]">
              {venue.name}
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              {[venue.address, data.total > 0 && `${data.total} ${data.total === 1 ? "partido" : "partidos"} en la temporada ${data.season}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <a href={mapsUrl(venue)} className="rounded-full bg-ink px-4.5 py-3 text-sm font-semibold text-white">
            Cómo llegar
          </a>
        </div>
      </header>

      {venue.lat !== null && venue.lng !== null && <VenueMap lat={venue.lat} lng={venue.lng} name={venue.name} />}

      {data.day && <NextDay day={data.day} now={data.now} logos={logos} />}

      <div className="flex flex-wrap gap-6">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5.5">
          {data.upcoming.length > 0 && (
            <SectionCard title="Próximos partidos">
              <MatchList matches={data.upcoming} now={data.now} focusId={focusId} logos={logos} champions={data.champions} />
            </SectionCard>
          )}
          {data.recent.length > 0 && (
            <SectionCard title="Últimos resultados">
              <MatchList matches={data.recent} now={data.now} focusId={focusId} logos={logos} champions={data.champions} />
            </SectionCard>
          )}
          {data.total === 0 && (
            <SectionCard title="Esta temporada">
              <p className="text-sm text-muted">No hay partidos en este campo esta temporada.</p>
            </SectionCard>
          )}
        </div>
        {data.teams.length > 0 && (
          <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5.5">
            <SectionCard title="Quién juega aquí">
              <TeamList teams={data.teams} focusId={focusId} logos={logos} />
            </SectionCard>
          </aside>
        )}
      </div>
    </main>
  );
}

function NextDay({ day, now, logos }: { day: NonNullable<VenuePageData["day"]>; now: string; logos: Logos }) {
  const diff = daysBetween(now, day.date);
  const eyebrow = diff === 0 ? "Hoy" : diff === 1 ? "Mañana" : day.when === "past" ? "Última jornada aquí" : "Próxima jornada aquí";
  const groups = new Map<string, DayMatch[]>();
  for (const match of day.matches) groups.set(match.time, [...(groups.get(match.time) ?? []), match]);
  return (
    <section aria-labelledby="jornada-del-campo" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 id="jornada-del-campo" className="mt-1 font-display text-[34px] leading-none font-extrabold uppercase sm:text-[40px]">
            {capitalize(formatLongDate(day.date, now))}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {day.matches.length} {day.matches.length === 1 ? "partido" : "partidos"} en este campo
          </p>
        </div>
        <Link href={`/partidos/dia/${day.date}`} className="text-sm font-semibold text-accent-text hover:underline">
          Todos los campos ese día →
        </Link>
      </div>
      {[...groups.entries()].map(([time, matches]) => (
        <div key={time} className="flex flex-col gap-2">
          <h3 className="font-display text-[22px] leading-none font-extrabold">{time}</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-3">
            {matches.map((match) => (
              <DayMatchCard key={match.id} match={match} logos={logos} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/** Compact rows: date and time, both teams, and the score or kick-off time. */
function MatchList({
  matches,
  now,
  focusId,
  logos,
  champions,
}: {
  matches: Match[];
  now: string;
  focusId: number | null;
  logos: Logos;
  /** Champions matches, with their star and blue. */
  champions: number[];
}) {
  return (
    <div className="flex flex-col">
      {matches.map((match) => {
        const isFocus = focusId !== null && (match.homeId === focusId || match.awayId === focusId);
        const isChampions = champions.includes(match.id);
        return (
          <Link
            key={match.id}
            href={`/partidos/${match.id}`}
            className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-line-soft px-2 py-2.5 text-sm sm:grid-cols-[150px_minmax(0,1fr)_auto] ${
              isFocus ? "bg-accent-soft" : "hover:bg-canvas"
            } ${isChampions ? "champions-light" : ""}`}
          >
            <span className="flex items-center gap-2 text-[13px] text-muted max-sm:col-span-2 sm:flex-col sm:items-start sm:gap-1">
              {match.played ? `${formatShortDate(match.date, now)} · ${match.date.slice(11, 16)}` : capitalize(relativeDay(match.date, now))}
              {isChampions && <ChampionsBadge />}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <Side id={match.homeId} name={match.homeName} logos={logos} />
              <Side id={match.awayId} name={match.awayName} logos={logos} />
            </span>
            <span className="text-right font-display text-xl font-extrabold">
              {match.played ? `${match.homeGoals}–${match.awayGoals}` : <span className="text-muted">{match.date.slice(11, 16)}</span>}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function Side({ id, name, logos }: { id: number; name: string; logos: Logos }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Crest src={logos[id]} name={name} size={20} />
      <span className="truncate">{name}</span>
    </span>
  );
}

function TeamList({ teams, focusId, logos }: { teams: VenuePageData["teams"]; focusId: number | null; logos: Logos }) {
  return (
    <ol className="flex flex-col">
      {teams.map((team) => {
        const content = (
          <>
            <Crest src={logos[team.id]} name={team.name} size={28} />
            <span className={`min-w-0 flex-1 truncate ${team.id === focusId ? "font-bold" : ""}`}>{team.name}</span>
            <span className="text-[13px] text-muted">
              {team.matches} {team.matches === 1 ? "partido" : "partidos"}
            </span>
          </>
        );
        const className = "flex items-center gap-2.5 border-t border-line-soft px-2 py-2.5 text-sm";
        return (
          <li key={team.id}>
            {team.slug ? (
              <Link href={`/equipos/${team.slug}`} className={`${className} hover:bg-canvas`}>
                {content}
              </Link>
            ) : (
              <div className={className}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
