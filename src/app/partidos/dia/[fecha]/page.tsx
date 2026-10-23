import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DayMatchCard } from "@/components/day-match-card";
import { Eyebrow } from "@/components/featured-match";
import { capitalize, daysBetween, formatLongDate, formatShortDate } from "@/lib/dates";
import { getTeams } from "@/lib/data";
import { getDayPageData, type DayMatch, type DayPageData } from "@/lib/views/day";

type Props = PageProps<"/partidos/dia/[fecha]">;
type Order = "hora" | "campo";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { fecha } = await params;
  const data = await getDayPageData(fecha);
  if (!data) return { title: "Partidos del día" };
  return { title: `Partidos del ${formatLongDate(data.day.date, data.now)}` };
}

export default function DayPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<DaySkeleton />}>
      <DayContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function DaySkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-7 sm:px-6" aria-busy="true">
      <div className="h-28 animate-pulse rounded-[22px] bg-line" />
      <div className="h-96 animate-pulse rounded-[22px] bg-line-soft" />
    </div>
  );
}

async function DayContent({ params, searchParams }: Props) {
  const [{ fecha }, query] = await Promise.all([params, searchParams]);
  const [data, teams] = await Promise.all([getDayPageData(fecha), getTeams()]);
  if (!data) notFound();
  const logos = Object.fromEntries(teams.map((t) => [t.id, t.logoUrl]));
  const order: Order = query.orden === "campo" ? "campo" : "hora";

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-7 px-4 pt-7 sm:px-6">
      <Header data={data} order={order} />
      {groupMatches(data.day.matches, order).map(([key, matches]) => (
        <section key={key} aria-label={key} className="flex flex-col gap-3">
          <h2 className="flex items-baseline gap-3 border-b border-line pb-2">
            <span className="font-display text-[28px] leading-none font-extrabold uppercase">{key}</span>
            <span className="text-sm text-muted">
              {matches.length} {matches.length === 1 ? "partido" : "partidos"}
            </span>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-3">
            {matches.map((match) => (
              <DayMatchCard key={match.id} match={match} logos={logos} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

/** Groups the day's matches (already sorted by time and venue) by kick-off time or by venue. */
function groupMatches(matches: DayMatch[], order: Order): [string, DayMatch[]][] {
  const groups = new Map<string, DayMatch[]>();
  for (const match of matches) {
    const key = order === "campo" ? match.venue || "Campo por confirmar" : match.time;
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }
  const entries = [...groups.entries()];
  return order === "campo" ? entries.sort((a, b) => a[0].localeCompare(b[0], "es")) : entries;
}

function Header({ data, order }: { data: DayPageData; order: Order }) {
  const { day } = data;
  const diff = daysBetween(data.now, day.date);
  const eyebrow = diff === 0 ? "Hoy" : diff === 1 ? "Mañana" : diff === -1 ? "Ayer" : null;
  const count = day.matches.length;
  const base = `/partidos/dia/${day.date}`;

  return (
    <header className="flex flex-col gap-4">
      <nav aria-label="Otros días" className="flex justify-between gap-3 text-sm font-semibold">
        {data.previous ? (
          <Link href={`/partidos/dia/${data.previous}`} className="hover:text-accent-text">
            ← {formatShortDate(data.previous, data.now)}
          </Link>
        ) : (
          <span />
        )}
        {data.next && (
          <Link href={`/partidos/dia/${data.next}`} className="hover:text-accent-text">
            {formatShortDate(data.next, data.now)} →
          </Link>
        )}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className="mt-1 font-display text-[40px] leading-none font-extrabold uppercase sm:text-[52px]">
            {capitalize(formatLongDate(day.date, data.now))}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {count} {count === 1 ? "partido" : "partidos"} en {day.venues} {day.venues === 1 ? "campo" : "campos"}
            {day.competition && ` · ${day.competition}`}
          </p>
        </div>
        <div role="group" aria-label="Agrupar los partidos" className="flex gap-1.5">
          <OrderLink href={base} active={order === "hora"}>
            Por hora
          </OrderLink>
          <OrderLink href={`${base}?orden=campo`} active={order === "campo"}>
            Por campo
          </OrderLink>
        </div>
      </div>
    </header>
  );
}

function OrderLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
        active ? "border-accent bg-accent-soft text-accent-text" : "border-line text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
