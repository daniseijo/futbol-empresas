import { IdealSeven } from "@/components/ideal-seven";
import { Leaders, MarketValue } from "@/components/team/leaders";
import { SectionCard } from "@/components/team/section-card";
import { SquadView } from "@/components/team/squad-view";
import { tabMetadata, TeamTab } from "../team-page";

export function generateMetadata({ params }: PageProps<"/equipos/[slug]/plantilla">) {
  return tabMetadata(params, "Plantilla");
}

export default function TeamSquadPage({ params }: PageProps<"/equipos/[slug]/plantilla">) {
  return (
    <TeamTab
      params={params}
      render={(data) =>
        data.squad.length === 0 ? (
          <SectionCard title="Plantilla">
            <p className="text-sm text-muted">La plantilla de este equipo todavía no se ha cargado o no tiene jugadores esta temporada.</p>
          </SectionCard>
        ) : (
          <div className="flex flex-wrap gap-6">
            <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5.5">
              <SquadView squad={data.squad} />
            </div>
            <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5.5">
              {data.ideal && (
                <IdealSeven
                  lines={data.ideal}
                  crests={false}
                  aside={<span className="text-sm text-muted">Temporada {data.season.name}</span>}
                />
              )}
              <SectionCard title="Líderes">
                <Leaders squad={data.squad} columns={1} />
              </SectionCard>
              <MarketValue squad={data.squad} />
            </aside>
          </div>
        )
      }
    />
  );
}
