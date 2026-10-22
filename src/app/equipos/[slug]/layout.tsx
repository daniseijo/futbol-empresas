import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TeamHeader, TeamHeaderSkeleton } from "@/components/team/team-header";
import { siteConfig } from "@/config/site";
import { getTeamPageData } from "@/lib/views/team";

/** En el build se generan el equipo principal y sus rivales de grupo; el resto, en la primera visita. */
export async function generateStaticParams() {
  const data = await getTeamPageData(siteConfig.focusTeamSlug);
  const rivals = data ? data.standings.map((row) => data.slugs[row.teamId]).filter(Boolean) : [];
  return [...new Set([siteConfig.focusTeamSlug, ...rivals])].map((slug) => ({ slug }));
}

export default function TeamLayout({ children, params }: LayoutProps<"/equipos/[slug]">) {
  return (
    <>
      <Suspense fallback={<TeamHeaderSkeleton />}>
        <Header params={params} />
      </Suspense>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">{children}</div>
    </>
  );
}

async function Header({ params }: Pick<LayoutProps<"/equipos/[slug]">, "params">) {
  const { slug } = await params;
  const data = await getTeamPageData(slug);
  if (!data) notFound();
  return <TeamHeader data={data} />;
}
