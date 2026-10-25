import Image from "next/image";
import { Fragment } from "react";
import type { Match } from "@/lib/sportspress/types";
import { getVenue } from "@/lib/sportspress/venues";
import { longestWord } from "@/lib/text";
import type { TeamPageData } from "@/lib/views/team";
import { Crest } from "../crest";
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

/** The name's size: a long word ("Telecomunicaciones") gets a smaller one so it fits a phone without being cut. */
function nameSize(name: string) {
  const longest = longestWord(name);
  if (longest <= 11) return "text-[64px] sm:text-[96px]";
  if (longest <= 15) return "text-[48px] sm:text-[96px]";
  return "text-[40px] sm:text-[80px]";
}

/** Header shared by all of a team's tabs. */
export function TeamHeader({ data }: { data: TeamPageData }) {
  const { team, row, group, standings, balance } = data;
  const venue = homeVenue(data.matches, team.id);
  const stats = [
    { value: row ? `${row.position}º` : "—", label: `de ${standings.length || "—"}`, accent: true },
    { value: String(row?.points ?? 0), label: "puntos" },
    { value: String(balance.played), label: "jugados" },
    { value: String(balance.goalsFor), label: "a favor" },
    { value: String(balance.goalsAgainst), label: "en contra" },
  ];
  return (
    <section className="relative overflow-hidden border-b border-line bg-surface">
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
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#fff_40%,rgba(255,255,255,0.85)_52%,rgba(255,255,255,0)_75%)] max-md:hidden" />
          {data.heroPhoto.caption && (
            <span className="absolute right-4 bottom-16 hidden rounded-md bg-white/85 px-2 py-1 text-xs md:block">{data.heroPhoto.caption}</span>
          )}
        </>
      ) : (
        team.logoUrl && (
          <Image src={team.logoUrl} alt="" width={420} height={420} className="absolute top-[-60px] right-[-40px] opacity-10 blur-[2px]" />
        )
      )}
      <div className="relative mx-auto flex max-w-7xl flex-col gap-6.5 px-4 pt-12 pb-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-5.5">
          <Crest src={team.logoUrl} name={team.name} size={108} />
          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex flex-wrap gap-2">
              {group && (
                <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold tracking-[0.06em] text-on-accent uppercase">
                  {group.competition} {data.season.name}
                </span>
              )}
              {group && (
                <span className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold tracking-[0.06em] uppercase">
                  {group.phase ? `${group.phase} · ` : ""}
                  {group.name}
                </span>
              )}
            </div>
            <h1 className={`font-display leading-[0.88] font-extrabold uppercase [overflow-wrap:break-word] hyphens-auto ${nameSize(team.name)}`}>{team.name}</h1>
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
              <div key={stat.label} className="bg-white px-3 py-3 sm:px-4">
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
