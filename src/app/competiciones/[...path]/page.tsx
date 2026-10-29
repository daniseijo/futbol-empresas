import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { IdealSeven } from "@/components/ideal-seven";
import { SectionCard } from "@/components/team/section-card";
import { StandingsTable } from "@/components/team/standings-table";
import { championsFaseLigaRedirect, getCompetitionPageData, type ChildCard, type CompetitionPageData } from "@/lib/views/competition";
import { ChampionsSector } from "./champions-sector";
import { BracketCard, Rounds, TallyCard } from "./parts";

const numberFormat = new Intl.NumberFormat("es-ES");

type Props = PageProps<"/competiciones/[...path]">;

function single(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ path }, query] = await Promise.all([params, searchParams]);
  const data = await getCompetitionPageData(path, single(query.temporada));
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
  const [{ path }, query] = await Promise.all([params, searchParams]);
  // A Champions fase liga lives in its sector's page now, in the "Fase liga" tab.
  const sectorHref = await championsFaseLigaRedirect(path);
  if (sectorHref) {
    const search = new URLSearchParams({ fase: "liga" });
    for (const key of ["temporada", "jornada"]) {
      const value = single(query[key]);
      if (value) search.set(key, value);
    }
    redirect(`${sectorHref}?${search}`);
  }
  const data = await getCompetitionPageData(path, single(query.temporada));
  if (!data) notFound();
  if (data.champions) return <ChampionsSector data={data} champions={data.champions} path={path} query={query} />;

  // Rounds are navigated with ?jornada=, keeping the season.
  const basePath = `/competiciones/${path.join("/")}`;
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
      {data.brackets.map((bracket, index) => (
        <BracketCard key={index} bracket={bracket} data={data} />
      ))}
      {data.group?.knockout && (
        <div className="lg:max-w-[560px]">
          <Rounds
            group={data.group}
            selected={single(query.jornada)}
            roundHref={roundHref}
            data={data}
            title={data.brackets.length > 0 ? "Otros partidos" : undefined}
          />
        </div>
      )}
      {data.group && !data.group.knockout && (
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
      {(data.scorers.length > 0 || data.cracks.length > 0 || data.ideal) && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.ideal && <IdealSeven lines={data.ideal} />}
          <TallyCard title="Pichichi" unit="goles" items={data.scorers} />
          <TallyCard title="MVP" unit="veces" items={data.cracks} note="Veces elegido mejor jugador del partido." />
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
    <section className="flex flex-col gap-4 card px-4 py-6 sm:px-7">
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
            <span className="line-clamp-2">{child.name.toUpperCase()}</span>
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

