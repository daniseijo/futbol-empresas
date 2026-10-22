import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTeam } from "@/lib/data";
import { getTeamPageData, type TeamPageData } from "@/lib/views/team";

type Params = Promise<{ slug: string }>;

/** Metadatos de una pestaña: «Plantilla de Embat · Futbolempresas». */
export async function tabMetadata(params: Params, label: string | null): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeam(slug);
  const name = team?.name ?? "Equipo";
  return { title: label ? `${label} de ${name}` : name };
}

/**
 * Envoltorio común de las pestañas: espera los parámetros dentro de Suspense
 * (así la ruta sirve el esqueleto al instante) y carga los datos del equipo.
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
