import Image from "next/image";
import { FeaturedFooter, FeaturedHero } from "@/components/featured-match";
import { IdealSeven } from "@/components/ideal-seven";
import { Leaders } from "@/components/team/leaders";
import { MatchRow } from "@/components/team/match-row";
import { SectionCard } from "@/components/team/section-card";
import { StandingsZone } from "@/components/team/standings-table";
import { VideoEmbed } from "@/components/video-embed";
import type { TeamPageData } from "@/lib/views/team";
import { tabMetadata, TeamTab } from "./team-page";

export function generateMetadata({ params }: PageProps<"/equipos/[slug]">) {
  return tabMetadata(params, null);
}

export default function TeamSummaryPage({ params }: PageProps<"/equipos/[slug]">) {
  return <TeamTab params={params} render={(data) => <Summary data={data} />} />;
}

function Summary({ data }: { data: TeamPageData }) {
  const base = `/equipos/${data.team.slug}`;
  const recent = data.lastResults.slice(0, 3);
  return (
    <div className="flex flex-wrap gap-6">
      <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5.5">
        {data.featured && (
          <section className="flex flex-col card overflow-hidden">
            <div className="flex flex-col gap-5 px-4 py-6 sm:px-7">
              <FeaturedHero team={data} logos={data.logos} slugs={data.slugs} now={data.now} teamPath={base} />
            </div>
            <FeaturedFooter team={data} />
          </section>
        )}

        <SectionCard title="Últimos resultados" link={{ href: `${base}/partidos`, label: "Todos los partidos" }}>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Todavía no ha jugado esta temporada.</p>
          ) : (
            recent.map((match) => (
              <MatchRow key={match.id} match={match} teamId={data.team.id} now={data.now} logos={data.logos} roundLabel={data.roundLabels[match.id]} />
            ))
          )}
        </SectionCard>

        {data.squad.length > 0 && (
          <SectionCard title="Los que más suman" link={{ href: `${base}/plantilla`, label: "Ver la plantilla" }}>
            <Leaders squad={data.squad} />
          </SectionCard>
        )}

        {data.latestVideo && (
          <SectionCard title="Último resumen" link={{ href: `/partidos/${data.latestVideo.matchId}`, label: "Ver el partido" }}>
            <VideoEmbed id={data.latestVideo.id} title={data.latestVideo.title} />
          </SectionCard>
        )}

        {data.photos.length > 0 && (
          <SectionCard title="Fotos" link={data.team.flickrAlbumUrl ? { href: data.team.flickrAlbumUrl, label: "Álbum en Flickr" } : undefined}>
            <div className="grid auto-rows-[150px] grid-cols-2 gap-2.5 sm:grid-cols-[2fr_1fr_1fr]">
              {data.photos.slice(0, 5).map((photo, index) => (
                <figure key={photo.url} className={`relative overflow-hidden rounded-[14px] ${index === 0 ? "sm:row-span-2" : ""}`}>
                  <Image src={photo.url} alt={photo.caption} fill sizes="(min-width: 640px) 40vw, 50vw" className="object-cover" />
                  {index === 0 && (
                    <figcaption className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[13px] font-semibold">{photo.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5.5">
        {data.group && data.standings.length > 0 && (
          <SectionCard title={`Así va el ${data.group.name}`} link={{ href: `${base}/clasificacion`, label: "Clasificación" }}>
            <StandingsZone rows={data.standings} teamId={data.team.id} logos={data.logos} slugs={data.slugs} />
          </SectionCard>
        )}
        {data.ideal && <IdealSeven lines={data.ideal} crests={false} link={{ href: `${base}/plantilla`, label: "Ver la plantilla" }} />}
        <SeasonNumbers data={data} />
      </aside>
    </div>
  );
}

function SeasonNumbers({ data }: { data: TeamPageData }) {
  const { balance } = data;
  const items = [
    { value: balance.won, label: "victorias", className: "bg-canvas" },
    { value: balance.drawn, label: "empates", className: "bg-canvas" },
    { value: balance.lost, label: "derrotas", className: "bg-loss-soft text-loss" },
  ];
  return (
    <section className="flex flex-col gap-3 card px-4 py-5 sm:p-5">
      <h2 className="font-display text-2xl font-extrabold uppercase">Esta temporada</h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        {items.map((item) => (
          <div key={item.label} className={`rounded-xl p-2.5 ${item.className}`}>
            <div className="font-display text-[32px] font-extrabold">{item.value}</div>
            <div className="text-xs">{item.label}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted">
        {balance.goalsFor} goles a favor y {balance.goalsAgainst} en contra en {balance.played} {balance.played === 1 ? "partido" : "partidos"}.
      </p>
    </section>
  );
}
