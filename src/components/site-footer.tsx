import Link from "next/link";
import { siteConfig } from "@/config/site";
import { getLastSync } from "@/lib/data";
import { LastSync } from "./last-sync";

export async function SiteFooter() {
  const lastSync = await getLastSync();
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
        <span>
          Datos de{" "}
          <a href={siteConfig.sourceSite} className="font-semibold text-ink underline-offset-2 hover:underline">
            futbolempresas.es
          </a>
          . Web no oficial.{lastSync && <> <LastSync stamp={lastSync} /></>}
        </span>
        <span className="flex gap-4">
          <Link href="/slack" className="font-semibold text-ink underline-offset-2 hover:underline">
            Convocatorias en Slack
          </Link>
          <a href={siteConfig.youtubeChannel} className="font-semibold text-ink underline-offset-2 hover:underline">
            Canal de YouTube
          </a>
        </span>
      </div>
    </footer>
  );
}
