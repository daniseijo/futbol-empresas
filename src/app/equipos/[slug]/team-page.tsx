import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTeamPageData, teamSummary, type TeamPageData } from "@/lib/views/team";

type Params = Promise<{ slug: string }>;

/**
 * A tab's metadata: "Plantilla de Embat · Futbolempresas", described by the
 * team's position ("9º de 9 · Liga Apertura 26/27 · Grupo 20") for link previews.
 */
export async function tabMetadata(params: Params, label: string | null): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTeamPageData(slug);
  if (!data) return { title: label ?? "Equipo" };
  const name = data.team.name;
  const position = data.row ? `${data.row.position}º de ${data.standings.length} · ` : "";
  return { title: label ? `${label} de ${name}` : name, description: position + teamSummary(data) };
}

/**
 * Shared wrapper for the tabs: awaits the params inside Suspense (so the route
 * serves the skeleton instantly) and loads the team data.
 */
export function TeamTab({ params, render }: { params: Params; render: (data: TeamPageData) => React.ReactNode }) {
  return (
    <Suspense fallback={<TabSkeleton />}>
      <TabContent params={params} render={render} />
    </Suspense>
  );
}

async function TabContent({ params, render }: { params: Params; render: (data: TeamPageData) => React.ReactNode }) {
  const { slug } = await params;
  const data = await getTeamPageData(slug);
  if (!data) notFound();
  return <>{render(data)}</>;
}

export function TabSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]" aria-busy="true">
      <div className="h-56 animate-pulse rounded-[22px] bg-line" />
      <div className="h-56 animate-pulse rounded-[22px] bg-line-soft" />
    </div>
  );
}
