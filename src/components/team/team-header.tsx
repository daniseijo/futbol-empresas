import Image from "next/image";
import { Fragment } from "react";
import type { Match } from "@/lib/sportspress/types";
import { getVenue } from "@/lib/sportspress/venues";
import { fitFontSize } from "@/lib/text";
import type { TeamPageData } from "@/lib/views/team";
import { ChampionsStar } from "../champions";
import { Crest } from "../crest";
import { featuredSurface } from "../featured-match";
import { ShareButton } from "../share-button";
import { SlackButton } from "../slack-button";
import { VenueLink } from "../venue-link";
import { TeamTabs } from "./team-tabs";

function homeVenue(matches: Match[], teamId: number) {
  const counts = new Map<number, number>();
  for (const m of matches) {
    if (m.venueId) counts.set(m.venueId, (counts.get(m.venueId) ?? 0) + (m.homeId === teamId ? 2 : 1));
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? getVenue(best[0]) : null;
}

/**
 * Header shared by all of a team's tabs. It follows the featured match's group, every number from its row, so
 * in a Champions week it turns navy and starts again from 0 points.
 */
export function TeamHeader({ data }: { data: TeamPageData }) {
  const { team, row, group, standings } = data;
  const champions = data.featured?.champions ?? null;
  const venue = homeVenue(data.matches, team.id);
  const stats = [
    { value: row ? `${row.position}º` : "—", label: `de ${standings.length || "—"}`, accent: true },
    { value: String(row?.points ?? 0), label: "puntos" },
    { value: String(row?.played ?? 0), label: "jugados" },
    { value: String(row?.goalsFor ?? 0), label: "a favor" },
    { value: String(row?.goalsAgainst ?? 0), label: "en contra" },
  ];
  return (
    <section className={`relative overflow-hidden border-b border-line bg-surface ${featuredSurface(data)}`}>
      {data.heroPhoto ? (
        <>
          <Image
            src={data.heroPhoto.url}
            alt={data.heroPhoto.caption || `Foto de ${team.name}`}
            fill
            loading="eager"
            fetchPriority="high"
            sizes="62vw"
            className={`left-auto! w-[62%]! object-cover max-md:hidden ${team.photoUrl ? "object-[80%_35%]" : ""}`}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-surface)_40%,color-mix(in_srgb,var(--color-surface)_85%,transparent)_52%,transparent_75%)] max-md:hidden" />
          {data.heroPhoto.caption && (
            <span className="absolute right-4 bottom-16 hidden rounded-md bg-surface/85 px-2 py-1 text-xs md:block">{data.heroPhoto.caption}</span>
          )}
        </>
      ) : (
        // The blurred crest is a light square on navy.
        team.logoUrl &&
        !champions && (
          <Image src={team.logoUrl} alt="" width={420} height={420} className="absolute top-[-60px] right-[-40px] opacity-10 blur-[2px]" />
        )
      )}
      <div className="@container relative mx-auto flex max-w-7xl flex-col gap-6.5 px-4 pt-12 pb-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-5.5">
          <Crest src={team.logoUrl} name={team.name} size={108} />
          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex flex-wrap gap-2">
              {group && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-[0.06em] uppercase ${
                    champions ? "bg-champions-star text-champions-deep" : "bg-accent text-on-accent"
                  }`}
                >
                  {champions && <ChampionsStar size={10} />}
                  {group.competition} {data.season.name}
                </span>
              )}
              {group && (
                <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold tracking-[0.06em] uppercase">
                  {champions
                    ? [champions.sector && `Sector ${champions.sector}`, champions.phase].filter(Boolean).join(" · ")
                    : `${group.phase ? `${group.phase} · ` : ""}${group.name}`}
                </span>
              )}
            </div>
            {/* Its usual size, smaller only when the longest word would not fit (the crest sits beside it from `sm`). */}
            <h1
              className="font-display leading-[0.88] font-extrabold uppercase [overflow-wrap:break-word] [--base:64px] [--fit-width:100cqi] [--min:32px] sm:[--base:96px] sm:[--fit-width:calc(100cqi_-_130px)] sm:[--min:48px]"
              style={{ fontSize: fitFontSize(team.name, 0.48) }}
            >
              {team.name}
            </h1>
            <p className="text-[15px] text-muted">
              {[
                venue && (
                  <>
                    Juega en <VenueLink venue={venue} />
                  </>
                ),
                data.squad.length > 0 && `${data.squad.length} jugadores`,
                data.seniority,
              ]
                .filter(Boolean)
                .map((part, index) => (
                  <Fragment key={index}>
                    {index > 0 && " · "}
                    {part}
                  </Fragment>
                ))}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid grid-cols-5 gap-px overflow-hidden rounded-[14px] border border-line bg-line">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-surface px-3 py-3 sm:px-4">
                <div className={`font-display text-[32px] leading-none font-extrabold sm:text-[38px] ${stat.accent ? "text-accent-text" : ""}`}>{stat.value}</div>
                <div className="text-xs whitespace-nowrap text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton title={team.name} />
            <SlackButton slug={team.slug} />
          </div>
        </div>
      </div>
      <TeamTabs slug={team.slug} />
    </section>
  );
}

export function TeamHeaderSkeleton() {
  return (
    <div className="border-b border-line bg-surface" aria-busy="true">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="size-28 animate-pulse rounded-3xl bg-line" />
        <div className="mt-6 h-16 w-72 animate-pulse rounded-xl bg-line" />
        <div className="mt-6 h-16 w-96 max-w-full animate-pulse rounded-xl bg-line-soft" />
      </div>
    </div>
  );
}
