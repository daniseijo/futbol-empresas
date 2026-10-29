import Link from "next/link";
import { ChampionsStar } from "@/components/champions";
import { Crest } from "@/components/crest";
import { IdealSeven } from "@/components/ideal-seven";
import { SectionCard } from "@/components/team/section-card";
import { StandingsTable } from "@/components/team/standings-table";
import { formatShortDate } from "@/lib/dates";
import type { ChampionsSectorData, CompetitionPageData } from "@/lib/views/competition";
import { BracketCard, Rounds, TallyCard } from "./parts";

const numberFormat = new Intl.NumberFormat("es-ES");

type Query = Record<string, string | string[] | undefined>;

const TABS = [
  { key: "liga", label: "Fase liga" },
  { key: "eliminatorias", label: "Eliminatorias" },
  { key: "goleadores", label: "Goleadores y MVP" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function single(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/**
 * A Champions sector's page: the page of its whole Champions, from the fase liga to the final. The tab
 * (?fase=), the round (?jornada=) and the standings filter (?rivales=1) live in the URL, so they survive a
 * shared link and going back.
 */
export function ChampionsSector({
  data,
  champions,
  path,
  query,
}: {
  data: CompetitionPageData;
  champions: ChampionsSectorData;
  path: string[];
  query: Query;
}) {
  const basePath = `/competiciones/${path.join("/")}`;
  const href = (changes: Partial<Record<"fase" | "jornada" | "rivales", string | null>>) => {
    const search = new URLSearchParams();
    for (const key of ["temporada", "fase", "jornada", "rivales"] as const) {
      const value = key in changes ? changes[key as keyof typeof changes] : single(query[key]);
      if (value) search.set(key, value);
    }
    return search.size > 0 ? `${basePath}?${search}` : basePath;
  };
  const requested = single(query.fase);
  const tab: Tab = TABS.find((t) => t.key === requested)?.key ?? (champions.knockoutStarted ? "eliminatorias" : "liga");

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-7 sm:px-6">
      <Header data={data} champions={champions} />
      <nav aria-label="Fases" className="-mt-1 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={href({ fase: t.key, jornada: null })}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`border-b-3 px-4 py-3 text-[15px] whitespace-nowrap ${
                active ? "border-champions-text font-semibold text-ink" : "border-transparent font-medium text-muted hover:border-line hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {/* The cards keep white, with the Champions blue in place of the coral. */}
      <div className="champions-light flex flex-col gap-6">
        {tab === "liga" && <FaseLiga data={data} champions={champions} query={query} href={href} />}
        {tab === "eliminatorias" && <Knockout data={data} champions={champions} query={query} href={href} />}
        {tab === "goleadores" && <Leaders data={data} />}
      </div>
    </main>
  );
}

function Header({ data, champions }: { data: CompetitionPageData; champions: ChampionsSectorData }) {
  const parents = data.crumbs.slice(0, -1);
  const stats = [
    { value: numberFormat.format(data.totals.teams), label: "equipos" },
    { value: `${numberFormat.format(data.totals.played)}/${numberFormat.format(data.totals.total)}`, label: "partidos jugados" },
    { value: numberFormat.format(data.totals.goals), label: "goles" },
  ];
  return (
    <section className="flex flex-col gap-5 card champions-night px-4 py-6 sm:px-7">
      <nav aria-label="Competición" className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <ChampionsStar className="text-champions-star" />
        {parents.map((crumb, index) => (
          <span key={crumb.href} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">›</span>}
            <Link href={crumb.href} className="hover:text-ink hover:underline">
              {crumb.name}
            </Link>
          </span>
        ))}
      </nav>
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
      <ol aria-label="Camino a la final" className="flex gap-2 overflow-x-auto pb-1">
        {champions.steps.map((step) => (
          <li
            key={step.phase}
            aria-current={step.state === "current" ? "step" : undefined}
            className={`flex min-w-30 flex-1 flex-col gap-0.5 rounded-xl border px-3 py-2 ${
              step.state === "current"
                ? "border-champions-star bg-champions-star text-champions-deep"
                : step.state === "done"
                  ? "border-line"
                  : "border-line-soft text-muted"
            }`}
          >
            <span className="text-sm font-bold">{step.phase}</span>
            <span className={`text-xs ${step.state === "current" ? "" : "text-muted"}`}>{step.detail}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface PanelProps {
  data: CompetitionPageData;
  champions: ChampionsSectorData;
  query: Query;
  href: (changes: Partial<Record<"fase" | "jornada" | "rivales", string | null>>) => string;
}

function FaseLiga({ data, champions, query, href }: PanelProps) {
  const faseLiga = champions.faseLiga;
  if (!faseLiga) {
    return (
      <SectionCard title="Fase liga">
        <p className="text-sm text-muted">No hay partidos de fase liga en la temporada {data.season.name}.</p>
      </SectionCard>
    );
  }
  const group = faseLiga.group;
  // The filter only makes sense when the focus team plays the fase liga.
  const canFilter = champions.rivals.length > 1;
  const onlyRivals = canFilter && single(query.rivales) === "1";
  const roundHref = (key: string) => href({ fase: "liga", jornada: key });
  return (
    <>
      {/* Seasons that played the fase liga as a knockout. */}
      {faseLiga.brackets.map((bracket, index) => (
        <BracketCard key={index} bracket={bracket} data={data} />
      ))}
      {group && !group.knockout && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          <SectionCard
            title="Clasificación"
            aside={
              canFilter && (
                <Link
                  href={href({ rivales: onlyRivals ? null : "1" })}
                  scroll={false}
                  aria-pressed={onlyRivals}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] ${
                    onlyRivals ? "border-accent bg-accent-soft font-semibold text-accent-text" : "border-line hover:border-ink"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-4 items-center justify-center rounded border text-[11px] ${
                      onlyRivals ? "border-accent bg-accent text-on-accent" : "border-line"
                    }`}
                  >
                    {onlyRivals ? "✓" : ""}
                  </span>
                  Solo mi equipo y sus rivales
                </Link>
              )
            }
          >
            <StandingsTable
              rows={onlyRivals ? group.standings.filter((row) => champions.rivals.includes(row.teamId)) : group.standings}
              teamId={data.focusTeamId ?? -1}
              logos={data.logos}
              slugs={data.slugs}
            />
            <p className="text-xs text-muted">
              3 puntos por victoria y 1 por empate. A igualdad de puntos, cuenta la diferencia de goles y después los goles a favor.
            </p>
          </SectionCard>
          <div className="flex min-w-0 flex-col gap-5">
            <Rounds group={group} selected={single(query.jornada)} roundHref={roundHref} data={data} />
            {champions.focusPath && <FocusPath data={data} path={champions.focusPath} />}
          </div>
        </div>
      )}
      {group?.knockout && <Rounds group={group} selected={single(query.jornada)} roundHref={roundHref} data={data} />}
    </>
  );
}

function FocusPath({ data, path }: { data: CompetitionPageData; path: NonNullable<ChampionsSectorData["focusPath"]> }) {
  return (
    <SectionCard title={`El camino de ${path.teamName}`}>
      <div className="flex flex-col">
        {path.entries.map(({ label, match }) => {
          const home = match.homeId === data.focusTeamId;
          const rival = home ? { id: match.awayId, name: match.awayName } : { id: match.homeId, name: match.homeName };
          const own = home ? match.homeGoals : match.awayGoals;
          const other = home ? match.awayGoals : match.homeGoals;
          return (
            <Link
              key={match.id}
              href={`/partidos/${match.id}`}
              className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-line-soft py-2.5 hover:bg-canvas"
            >
              <span className="font-display text-lg leading-none font-extrabold text-accent-text">{label}</span>
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <Crest src={data.logos[rival.id]} name={rival.name} size={24} />
                <span className="truncate">
                  {rival.name}
                  <span className="text-muted"> · {home ? "en casa" : "fuera"}</span>
                </span>
              </span>
              <span className="text-right text-sm whitespace-nowrap">
                {match.played ? (
                  <b className="font-display text-lg">
                    {own}–{other}
                  </b>
                ) : (
                  <span className="text-muted">
                    {formatShortDate(match.date, data.now)} · {match.date.slice(11, 16)}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}

function Knockout({ data, champions, query, href }: PanelProps) {
  const group = data.group?.knockout ? data.group : null;
  if (data.brackets.length === 0 && !group) {
    return (
      <SectionCard title="Cuadro">
        <p className="text-sm text-muted">El cuadro aparece cuando acabe la fase liga y la liga publique las eliminatorias.</p>
        {champions.previousSeason && (
          <Link
            href={`${champions.previousSeason.href}${champions.previousSeason.href.includes("?") ? "&" : "?"}fase=eliminatorias`}
            className="self-start text-sm font-semibold text-accent-text hover:underline"
          >
            Ver el cuadro de la {champions.previousSeason.name} →
          </Link>
        )}
      </SectionCard>
    );
  }
  return (
    <>
      {data.brackets.map((bracket, index) => (
        <BracketCard key={index} bracket={bracket} data={data} />
      ))}
      {group && (
        <div className="lg:max-w-[560px]">
          <Rounds
            group={group}
            selected={single(query.jornada)}
            roundHref={(key) => href({ fase: "eliminatorias", jornada: key })}
            data={data}
            title={data.brackets.length > 0 ? "Otros partidos" : undefined}
          />
        </div>
      )}
    </>
  );
}

function Leaders({ data }: { data: CompetitionPageData }) {
  if (data.scorers.length === 0 && data.cracks.length === 0 && !data.ideal) {
    return (
      <SectionCard title="Goleadores y MVP">
        <p className="text-sm text-muted">El pichichi, el MVP y el 7 ideal de la Champions de este sector aparecen con el primer partido jugado.</p>
      </SectionCard>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {data.ideal && <IdealSeven lines={data.ideal} />}
      <TallyCard title="Pichichi" unit="goles" items={data.scorers} />
      <TallyCard title="MVP" unit="veces" items={data.cracks} note="Veces elegido mejor jugador del partido." />
    </div>
  );
}
