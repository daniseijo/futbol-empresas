import Link from "next/link";
import { siteConfig } from "@/config/site";
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
    <header className="z-40 border-b border-line bg-surface pt-[env(safe-area-inset-top)] md:sticky md:top-0">
      <div className="relative mx-auto flex max-w-7xl items-center gap-x-2.5 px-4 py-3 sm:flex-wrap sm:gap-x-5 sm:gap-y-3 sm:px-6">
        <Link href="/" aria-label={`${siteConfig.name}, inicio`} className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[9px] bg-accent font-display text-[19px] font-extrabold text-on-accent">
            FE
          </span>
          <span className="font-display text-[17px] font-bold tracking-[0.04em] sm:text-[23px]">FUTBOLEMPRESAS</span>
        </Link>
        <MainNav />
        <TeamSearch teams={searchable} />
        <span className="hidden text-sm font-semibold text-muted md:block">Temporada {season.name}</span>
      </div>
    </header>
  );
}
