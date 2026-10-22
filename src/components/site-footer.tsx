import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
        <span>
          Datos de{" "}
          <a href={siteConfig.sourceSite} className="font-semibold text-ink underline-offset-2 hover:underline">
            futbolempresas.es
          </a>
          . Web no oficial.
        </span>
        <a href={siteConfig.youtubeChannel} className="font-semibold text-ink underline-offset-2 hover:underline">
          Canal de YouTube
        </a>
      </div>
    </footer>
  );
}
