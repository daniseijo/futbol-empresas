import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Crest } from "@/components/crest";
import { PlayerAvatar } from "@/components/player-avatar";
import { SectionCard } from "@/components/team/section-card";
import { StandingsTable } from "@/components/team/standings-table";
import { dayKey, formatShortDate } from "@/lib/dates";
import type { Match } from "@/lib/sportspress/types";
import {
  getCompetitionPageData,
  type ChildCard,
  type CompetitionPageData,
  type GroupData,
  type PlayerTally,
} from "@/lib/views/competition";

const numberFormat = new Intl.NumberFormat("es-ES");

type Props = PageProps<"/competiciones/[...ruta]">;

function single(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ ruta }, query] = await Promise.all([params, searchParams]);
  const data = await getCompetitionPageData(ruta, single(query.temporada));
  if (!data) return { title: "Competición" };
  const names = data.crumbs.map((crumb) => crumb.name).reverse();
  return { title: `${names.join(" · ")} ${data.season.name}` };
}

export default function CompetitionPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<CompetitionSkeleton />}>
      <CompetitionContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function CompetitionSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pt-7 sm:px-6" aria-busy="true">
      <div className="h-36 animate-pulse rounded-[22px] bg-line" />
      <div className="h-96 animate-pulse rounded-[22px] bg-line-soft" />
    </div>
  );
}

async function CompetitionContent({ params, searchParams }: Props) {
  const [{ ruta }, query] = await Promise.all([params, searchParams]);
  const data = await getCompetitionPageData(ruta, single(query.temporada));
  if (!data) notFound();

  // Las jornadas se navegan con ?jornada=, conservando la temporada.
  const basePath = `/competiciones/${ruta.join("/")}`;
  const roundHref = (key: string) => {
    const search = new URLSearchParams();
    const season = single(query.temporada);
    if (season) search.set("temporada", season);
    search.set("jornada", key);
    return `${basePath}?${search}`;
  };

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-7 sm:px-6">
      <Header data={data} />
      {data.children.length > 0 && <Children items={data.children} />}
      {data.group && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          <SectionCard title="Clasificación" aside={<span className="text-sm text-muted">Temporada {data.season.name}</span>}>
            <StandingsTable rows={data.group.standings} teamId={data.focusTeamId ?? -1} logos={data.logos} slugs={data.slugs} />
            <p className="text-xs text-muted">
              3 puntos por victoria y 1 por empate. A igualdad de puntos, cuenta la diferencia de goles y después los goles a favor.
            </p>
          </SectionCard>
          <Rounds group={data.group} selected={single(query.jornada)} roundHref={roundHref} data={data} />
        </div>
      )}
      {(data.scorers.length > 0 || data.cracks.length > 0) && (
        <div className="grid gap-5 md:grid-cols-2">
          <TallyCard title="Pichichi" unit="goles" items={data.scorers} />
          <TallyCard title="Crack" unit="veces" items={data.cracks} note="Veces elegido mejor jugador del partido." />
        </div>
      )}
      {data.totals.total === 0 && (
        <SectionCard title="Sin partidos">
          <p className="text-sm text-muted">No hay partidos de esta competición en la temporada {data.season.name}.</p>
        </SectionCard>
      )}
    </main>
  );
}

function Header({ data }: { data: CompetitionPageData }) {
  const parents = data.crumbs.slice(0, -1);
  const stats = [
    { value: numberFormat.format(data.totals.teams), label: "equipos" },
    { value: `${numberFormat.format(data.totals.played)}/${numberFormat.format(data.totals.total)}`, label: "partidos jugados" },
    { value: numberFormat.format(data.totals.goals), label: "goles" },
  ];
  return (
    <section className="flex flex-col gap-4 rounded-[22px] border border-line bg-surface p-6 sm:px-7">
      {parents.length > 0 && (
        <nav aria-label="Competición" className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {parents.map((crumb, index) => (
            <span key={crumb.href} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden="true">›</span>}
              <Link href={crumb.href} className="hover:text-accent-text hover:underline">
                {crumb.name}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[44px] leading-[0.95] font-extrabold uppercase sm:text-[56px]">{data.name}</h1>
        {data.seasons.length > 1 && (
          <nav aria-label="Temporadas" className="flex flex-wrap gap-1.5">
            {data.seasons.map((season) => {
              const active = season.name === data.season.name;
              return (
                <Link
                  key={season.name}
                  href={season.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full border px-3 py-1.5 text-[13px] ${
                    active ? "border-accent bg-accent font-semibold text-on-accent" : "border-line bg-canvas hover:border-ink"
                  }`}
                >
                  {season.name}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
      {data.totals.total > 0 && (
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[14px] border border-line bg-line">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-surface px-4 py-3">
              <div className="font-display text-[30px] leading-none font-extrabold">{stat.value}</div>
              <div className="text-[13px] text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Children({ items }: { items: ChildCard[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
      {items.map((child) => (
        <Link
          key={child.id}
          href={child.href}
          className={`flex flex-col gap-1 rounded-2xl border px-3.5 py-3 ${
            child.hasFocusTeam ? "border-accent bg-accent-soft text-accent-text" : "border-line bg-surface hover:border-ink"
          }`}
        >
          <span className={`flex justify-between gap-2 text-xs font-semibold ${child.hasFocusTeam ? "" : "text-muted"}`}>
            <span className="truncate">{child.name.toUpperCase()}</span>
            {child.leader && <span className="shrink-0">{child.leader.points} pts</span>}
          </span>
          <span className="truncate text-[15px] font-bold">{child.leader?.name ?? `${child.teams} equipos`}</span>
          <span className={`text-xs ${child.hasFocusTeam ? "" : "text-muted"}`}>
            {child.leader ? "Líder · " : ""}
            {child.played} de {child.total} partidos
          </span>
        </Link>
      ))}
    </div>
  );
}

function Rounds({
  group,
  selected,
  roundHref,
  data,
}: {
  group: GroupData;
  selected: string | null;
  roundHref: (key: string) => string;
  data: CompetitionPageData;
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
      title={round.label}
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
        {formatShortDate(round.date)} · {index + 1} de {group.rounds.length}
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

function RoundMatch({ match, roundDay, data }: { match: Match; roundDay: string; data: CompetitionPageData }) {
  const focus = match.homeId === data.focusTeamId || match.awayId === data.focusTeamId;
  const pending = !match.played && match.date < data.now;
  // Un partido aplazado a otro día enseña la fecha en lugar de la hora.
  const when = dayKey(match.date) === roundDay ? match.date.slice(11, 16) : formatShortDate(match.date);
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

function TallyCard({ title, unit, items, note }: { title: string; unit: string; items: PlayerTally[]; note?: string }) {
  return (
    <SectionCard title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Sin datos todavía.</p>
      ) : (
        <div className="flex flex-col">
          {items.map((item, index) => (
            <div key={item.playerId} className="grid grid-cols-[24px_40px_1fr_auto] items-center gap-2.5 border-t border-line-soft py-2">
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
            </div>
          ))}
        </div>
      )}
      {note && <p className="text-xs text-muted">{note}</p>}
    </SectionCard>
  );
}
