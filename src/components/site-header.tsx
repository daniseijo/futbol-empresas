import Link from "next/link";
import { getCurrentSeason, getTeams } from "@/lib/data";
import { MainNav } from "./main-nav";
import { TeamSearch, type SearchableTeam } from "./team-search";

export async function SiteHeader() {
  const [teams, season] = await Promise.all([getTeams(), getCurrentSeason()]);
  const searchable: SearchableTeam[] = teams.map((team) => ({
    slug: team.slug,
    name: team.name,
    logoUrl: team.logoUrl,
    active: team.seasonIds.includes(season.id),
  }));

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[9px] bg-accent font-display text-[19px] font-extrabold text-on-accent">
            FE
          </span>
          <span className="font-display text-[23px] font-bold tracking-[0.04em]">FUTBOLEMPRESAS</span>
        </Link>
        <MainNav />
        <TeamSearch teams={searchable} />
        <span className="hidden h-11 items-center rounded-[10px] border border-line px-3.5 text-sm font-semibold md:flex">
          Temporada {season.name}
        </span>
      </div>
    </header>
  );
}
