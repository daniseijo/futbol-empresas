import Image from "next/image";
import Link from "next/link";
import { Crest } from "@/components/crest";
import { FormBadges } from "@/components/form-badges";
import { Leaders } from "@/components/team/leaders";
import { MatchRow } from "@/components/team/match-row";
import { SectionCard } from "@/components/team/section-card";
import { StandingsZone } from "@/components/team/standings-table";
import { VideoEmbed } from "@/components/video-embed";
import { calendarUrl } from "@/lib/calendar";
import { formatLongDate, relativeDay } from "@/lib/dates";
import type { Match } from "@/lib/sportspress/types";
import { getVenue, mapsUrl } from "@/lib/sportspress/venues";
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
        {data.nextMatch && <NextMatchCard data={data} match={data.nextMatch} />}

        <SectionCard title="Últimos resultados" link={{ href: `${base}/partidos`, label: "Todos los partidos" }}>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Todavía no ha jugado esta temporada.</p>
          ) : (
            recent.map((match) => <MatchRow key={match.id} match={match} teamId={data.team.id} now={data.now} logos={data.logos} />)
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
        <SeasonNumbers data={data} />
      </aside>
    </div>
  );
}

function NextMatchCard({ data, match }: { data: TeamPageData; match: Match }) {
  const venue = getVenue(match.venueId);
  const side = (teamId: number, name: string, align: "left" | "right") => {
    const row = data.standings.find((r) => r.teamId === teamId);
    return (
      <div
        className={`flex min-w-0 flex-col-reverse items-center gap-2 text-center sm:flex-row sm:gap-4 ${
          align === "right" ? "sm:flex-row-reverse sm:text-left" : "sm:justify-end sm:text-right"
        }`}
      >
        <div className="min-w-0">
          <div className="font-display text-[22px] leading-none font-extrabold [overflow-wrap:anywhere] uppercase sm:text-[40px]">{name}</div>
          {row && (
            <div className="mt-1 flex items-center gap-2 text-[13px] font-medium max-sm:hidden">
              {row.position}º · {row.points} pts <FormBadges form={row.form.slice(-3)} size={20} />
            </div>
          )}
        </div>
        <Crest src={data.logos[teamId]} name={name} size={72} />
      </div>
    );
  };
  return (
    <article className="flex flex-col gap-5 rounded-[22px] bg-accent p-6.5 text-on-accent">
      <div className="flex flex-wrap justify-between gap-3 text-sm font-bold tracking-[0.08em] uppercase">
        <span>
          Próximo partido · {relativeDay(match.date, data.now)} · {formatLongDate(match.date)} · {match.date.slice(11, 16)}
        </span>
        {match.round && <span>Jornada {match.round}</span>}
      </div>
      <Link href={`/partidos/${match.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 sm:gap-6">
        {side(match.homeId, match.homeName, "left")}
        <div className="font-display text-[28px] font-extrabold sm:text-[40px]">VS</div>
        {side(match.awayId, match.awayName, "right")}
      </Link>
      {venue && (
        <div className="flex flex-wrap items-center justify-between gap-3.5 border-t border-ink/20 pt-4">
          <div>
            <div className="font-semibold">{venue.name}</div>
            {venue.address && <div className="text-[13px]">{venue.address}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/partidos/${match.id}`} className="rounded-[10px] bg-ink px-4 py-3 text-sm font-semibold text-white">
              Ver la previa
            </Link>
            <a href={mapsUrl(venue)} className="rounded-[10px] bg-white px-4 py-3 text-sm font-semibold text-ink">
              Cómo llegar
            </a>
            <a
              href={calendarUrl(match, venue.address ? `${venue.name}, ${venue.address}` : venue.name)}
              className="rounded-[10px] border-[1.5px] border-on-accent px-4 py-[11px] text-sm font-semibold"
            >
              Añadir al calendario
            </a>
          </div>
        </div>
      )}
    </article>
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
    <section className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-5">
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
