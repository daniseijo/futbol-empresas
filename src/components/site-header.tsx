import Link from "next/link";
import { siteConfig } from "@/config/site";
import { getCurrentSeason } from "@/lib/data";
import { MainNav } from "./main-nav";
import { SiteSearch } from "./site-search";

export async function SiteHeader() {
  const season = await getCurrentSeason();

  return (
    // Sticky on phones too: installed on an iPhone, iOS blurs whatever scrolls under the status bar unless a
    // fixed element sits there, in which case it extends that element's colour.
    <header className="sticky top-0 z-40 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
      <div className="relative mx-auto flex max-w-7xl items-center gap-x-2.5 px-4 py-3 sm:flex-wrap sm:gap-x-5 sm:gap-y-3 sm:px-6">
        <Link href="/" aria-label={`${siteConfig.name}, inicio`} className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[9px] bg-accent font-display text-[19px] font-extrabold text-on-accent">
            FE
          </span>
          <span className="font-display text-[17px] font-bold tracking-[0.04em] sm:text-[23px]">FUTBOLEMPRESAS</span>
        </Link>
        <MainNav />
        <SiteSearch />
        <span className="hidden text-sm font-semibold text-muted md:block">Temporada {season.name}</span>
      </div>
    </header>
  );
}
