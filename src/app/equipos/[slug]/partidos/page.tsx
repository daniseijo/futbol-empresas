import Image from "next/image";
import { MatchRow, RestRow } from "@/components/team/match-row";
import { SectionCard } from "@/components/team/section-card";
import type { SeasonEntry, TeamPageData } from "@/lib/views/team";
import { tabMetadata, TeamTab } from "../team-page";

export function generateMetadata({ params }: PageProps<"/equipos/[slug]/partidos">) {
  return tabMetadata(params, "Partidos");
}

export default function TeamMatchesPage({ params }: PageProps<"/equipos/[slug]/partidos">) {
  return <TeamTab params={params} render={(data) => <Matches data={data} />} />;
}

function Matches({ data }: { data: TeamPageData }) {
  const nextId = data.nextMatch?.id;
  const dateOf = (entry: SeasonEntry) => (entry.kind === "match" ? entry.match.date : entry.date);
  // Próximos: los que aún no se han jugado y no han pasado (del más cercano al más lejano).
  // Jugados: todo lo demás, del más reciente al más antiguo (incluye descansos y partidos sin resultado).
  const isUpcoming = (entry: SeasonEntry) =>
    entry.kind === "match" ? !entry.match.played && entry.match.date >= data.now : entry.date.slice(0, 10) >= data.now.slice(0, 10);
  const upcoming = data.entries.filter(isUpcoming);
  const played = data.entries.filter((entry) => !isUpcoming(entry)).sort((a, b) => dateOf(b).localeCompare(dateOf(a)));

  const renderEntry = (entry: SeasonEntry) =>
    entry.kind === "rest" ? (
      <RestRow key={`rest-${entry.round}`} round={entry.round} date={entry.date} />
    ) : (
      <MatchRow
        key={entry.match.id}
        match={entry.match}
        teamId={data.team.id}
        now={data.now}
        logos={data.logos}
        hasVideo={entry.hasVideo}
        highlight={entry.match.id === nextId}
      />
    );

  return (
    <div className="flex flex-wrap gap-6">
      <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5.5">
        <SectionCard title="Próximos partidos" aside={<span className="text-sm text-muted">Temporada {data.season.name}</span>}>
          {upcoming.length === 0 ? <p className="text-sm text-muted">No hay partidos programados por ahora.</p> : upcoming.map(renderEntry)}
        </SectionCard>
        <SectionCard title="Partidos jugados">
          {played.length === 0 ? <p className="text-sm text-muted">Todavía no ha jugado esta temporada.</p> : played.map(renderEntry)}
          <p className="pt-1 text-xs text-muted">▶ el partido tiene resumen en vídeo · S/R: jugado sin resultado publicado</p>
        </SectionCard>
      </div>

      <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5.5">
        {(data.photos.length > 0 || data.team.video || data.team.flickrAlbumUrl) && (
          <section className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-5">
            <h2 className="font-display text-2xl font-extrabold uppercase">Fotos y vídeos</h2>
            {data.photos.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {data.photos.slice(0, 6).map((photo) => (
                  <div key={photo.url} className="relative aspect-[4/3] overflow-hidden rounded-xl">
                    <Image src={photo.url} alt={photo.caption} fill sizes="190px" className="object-cover" />
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-1.5 text-sm font-semibold text-accent-text">
              {data.team.video && (
                <a href={data.team.video.url} className="hover:underline">
                  Lista de vídeos en YouTube
                </a>
              )}
              {data.team.flickrAlbumUrl && (
                <a href={data.team.flickrAlbumUrl} className="hover:underline">
                  Álbum de fotos en Flickr
                </a>
              )}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
