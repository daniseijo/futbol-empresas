import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SectionCard } from "@/components/team/section-card";
import { getTeamHistory, type Tally, type TeamHistory } from "@/lib/views/team-history";
import { TabSkeleton, tabMetadata } from "../team-page";

export function generateMetadata({ params }: PageProps<"/equipos/[slug]/historial">) {
  return tabMetadata(params, "Historial");
}

export default function TeamHistoryPage({ params }: PageProps<"/equipos/[slug]/historial">) {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <HistoryContent params={params} />
    </Suspense>
  );
}

async function HistoryContent({ params }: Pick<PageProps<"/equipos/[slug]/historial">, "params">) {
  const { slug } = await params;
  const history = await getTeamHistory(slug);
  if (!history) notFound();
  return <History history={history} />;
}

const tallyLine = (t: Tally) => `${t.won} V · ${t.drawn} E · ${t.lost} D`;

function History({ history }: { history: TeamHistory }) {
  const { total } = history;
  if (history.seasons.length === 0) {
    return (
      <SectionCard title="Historial">
        <p className="text-sm text-muted">Todavía no hay partidos de este equipo en la base de datos.</p>
      </SectionCard>
    );
  }
  const totals = [
    { value: total.played, label: "partidos" },
    { value: total.won, label: "victorias", accent: true },
    { value: total.drawn, label: "empates" },
    { value: total.lost, label: "derrotas" },
    { value: total.goalsFor, label: "goles a favor" },
    { value: history.seasons.length, label: history.seasons.length === 1 ? "temporada" : "temporadas" },
  ];
  return (
    <div className="flex flex-col gap-5.5">
      <section className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-px overflow-hidden rounded-[18px] border border-line bg-line">
        {totals.map((item) => (
          <div key={item.label} className="bg-surface px-5 py-4">
            <div className={`font-display text-[40px] leading-none font-extrabold ${item.accent ? "text-accent-text" : ""}`}>{item.value}</div>
            <div className="text-[13px] text-muted">{item.label}</div>
          </div>
        ))}
      </section>

      {history.seasons.length === 1 && history.seasons[0].current && (
        <p className="rounded-[18px] border border-accent bg-accent-soft px-5 py-4 text-sm text-accent-text">
          Es su primera temporada en la liga: el historial irá creciendo partido a partido.
        </p>
      )}

      {history.seasons.map((season) => (
        <SectionCard
          key={season.seasonId}
          title={season.name}
          aside={
            <span className="flex items-center gap-2 text-sm text-muted">
              {season.current && (
                <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-bold tracking-[0.06em] text-on-accent">EN CURSO</span>
              )}
              {season.record.played} PJ · {tallyLine(season.record)}
            </span>
          }
        >
          {season.record.played > 0 && (
            <div className="flex h-2 overflow-hidden rounded-full bg-line-soft">
              <div className="bg-ink" style={{ width: `${(season.record.won / season.record.played) * 100}%` }} />
              <div className="bg-line" style={{ width: `${(season.record.drawn / season.record.played) * 100}%` }} />
              <div className="bg-accent" style={{ width: `${(season.record.lost / season.record.played) * 100}%` }} />
            </div>
          )}
          {season.stints.map((stint) => (
            <div key={stint.groupId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-line-soft py-3 sm:grid-cols-[minmax(0,1fr)_120px_150px_70px]">
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{stint.path[0]}</span>
                <span className="truncate text-[13px] text-muted">{stint.path.slice(1).join(" › ")}</span>
              </span>
              {stint.position ? (
                <span className="text-right font-display text-2xl font-extrabold sm:text-left">
                  {stint.position}º
                  <span className="ml-1 font-sans text-xs font-normal text-muted">
                    de {stint.teams}
                    {stint.finished ? "" : ", provisional"}
                  </span>
                </span>
              ) : (
                <span className="text-right text-[13px] text-muted sm:text-left">Eliminatoria</span>
              )}
              <span className="text-[13px] text-muted max-sm:col-span-2">
                {stint.record.played} PJ · {tallyLine(stint.record)}
              </span>
              <span className="text-right font-display text-xl font-bold max-sm:hidden">
                {stint.record.goalsFor}–{stint.record.goalsAgainst}
              </span>
            </div>
          ))}
        </SectionCard>
      ))}
      {history.since && <p className="text-xs text-muted">Partidos registrados desde la temporada {history.since}. Los puestos se calculan con los resultados de cada grupo.</p>}
    </div>
  );
}
