import { SectionCard } from "@/components/team/section-card";
import { StandingsTable } from "@/components/team/standings-table";
import type { TeamPageData } from "@/lib/views/team";
import { tabMetadata, TeamTab } from "../team-page";

export function generateMetadata({ params }: PageProps<"/equipos/[slug]/clasificacion">) {
  return tabMetadata(params, "Clasificación");
}

export default function TeamStandingsPage({ params }: PageProps<"/equipos/[slug]/clasificacion">) {
  return <TeamTab params={params} render={(data) => <Standings data={data} />} />;
}

function Standings({ data }: { data: TeamPageData }) {
  if (!data.group || data.standings.length === 0) {
    return (
      <SectionCard title="Clasificación">
        <p className="text-sm text-muted">Este equipo no está en ningún grupo esta temporada.</p>
      </SectionCard>
    );
  }
  const title = [data.group.competition, data.group.phase, data.group.name].filter(Boolean).join(" · ");
  return (
    <SectionCard title={title} link={{ href: data.group.href, label: `Ver grupo · ${data.season.name}` }}>
      <StandingsTable rows={data.standings} teamId={data.team.id} logos={data.logos} slugs={data.slugs} />
      <p className="text-xs text-muted">
        3 puntos por victoria y 1 por empate. A igualdad de puntos, cuenta la diferencia de goles y después los goles a favor. Los partidos sin
        resultado no cuentan.
      </p>
    </SectionCard>
  );
}
