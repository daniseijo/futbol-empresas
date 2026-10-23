import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTeam } from "@/lib/data";
import { getTeamPageData, type TeamPageData } from "@/lib/views/team";

type Params = Promise<{ slug: string }>;

/** A tab's metadata: "Plantilla de Embat · Futbolempresas". */
export async function tabMetadata(params: Params, label: string | null): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeam(slug);
  const name = team?.name ?? "Equipo";
  return { title: label ? `${label} de ${name}` : name };
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
