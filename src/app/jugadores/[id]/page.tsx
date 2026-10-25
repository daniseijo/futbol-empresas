import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Crest } from "@/components/crest";
import { OutcomeBadge } from "@/components/form-badges";
import { PlayerAvatar } from "@/components/player-avatar";
import { PlayerEvents } from "@/components/player-events";
import { SectionCard } from "@/components/team/section-card";
import { siteConfig } from "@/config/site";
import { getSquad, getTeam } from "@/lib/data";
import { formatShortDate } from "@/lib/dates";
import type { Position } from "@/lib/sportspress/types";
import { getPlayerPageData, type PlayerMatchRow, type PlayerPageData } from "@/lib/views/player";

const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const POSITION_LABEL: Record<Position, string> = { POR: "Portero", DEF: "Defensa", MED: "Medio", DEL: "Delantero" };

/** Ids arrive as URL text: anything that is not a number is a 404. */
function parseId(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

/**
 * The build generates the focus team's squad; the rest, on first visit. Without
 * this list the route never caches a player's page, and a missing player keeps
 * answering 200 instead of 404 after its first visit.
 */
export async function generateStaticParams() {
  const team = await getTeam(siteConfig.focusTeamSlug);
  const squad = team ? await getSquad(team.id) : [];
  // At least one param is required: "0" is never a player, so it prerenders as a 404.
  return squad.length > 0 ? squad.map((p) => ({ id: String(p.id) })) : [{ id: "0" }];
}

export async function generateMetadata({ params }: PageProps<"/jugadores/[id]">): Promise<Metadata> {
  const id = parseId((await params).id);
  const data = id ? await getPlayerPageData(id) : null;
  if (!data) return { title: "Jugador" };
  return { title: data.team ? `${data.displayName} (${data.team.name})` : data.displayName };
}

export default function PlayerPage({ params }: PageProps<"/jugadores/[id]">) {
  return (
    <Suspense fallback={<PlayerSkeleton />}>
      <PlayerContent params={params} />
    </Suspense>
  );
}

function PlayerSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pt-7 sm:px-6" aria-busy="true">
      <div className="h-48 animate-pulse rounded-[22px] bg-line" />
      <div className="h-96 animate-pulse rounded-[22px] bg-line-soft" />
    </div>
  );
}

async function PlayerContent({ params }: Pick<PageProps<"/jugadores/[id]">, "params">) {
  const id = parseId((await params).id);
  const data = id ? await getPlayerPageData(id) : null;
  if (!data) notFound();

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-7 sm:px-6">
      <Header data={data} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <SectionCard title="Partidos" aside={<span className="text-sm text-muted">{data.matches.length} en total</span>}>
          {data.matches.length === 0 && <p className="text-sm text-muted">Todavía no ha jugado ningún partido.</p>}
          <div className="flex flex-col">
            {data.matches.map((row) => (
              <MatchLine key={`${row.match.id}-${row.teamId}`} row={row} data={data} />
            ))}
          </div>
        </SectionCard>
        <Seasons data={data} />
      </div>
    </main>
  );
}

function Header({ data }: { data: PlayerPageData }) {
  const { totals } = data;
  const stats = [
    { value: String(totals.matches), label: totals.matches === 1 ? "partido" : "partidos" },
    { value: String(totals.goals), label: totals.goals === 1 ? "gol" : "goles" },
    { value: String(totals.assists), label: totals.assists === 1 ? "asistencia" : "asistencias" },
    { value: String(totals.cracks), label: "veces MVP" },
    { value: totals.matches ? decimal.format(totals.goals / totals.matches) : "—", label: "goles por partido" },
    { value: `${totals.yellowCards}/${totals.redCards}`, label: "amarillas/rojas" },
  ];
  if (data.current) {
    stats.push(
      { value: decimal.format(data.current.mvpPoints), label: "puntos" },
      { value: `${money.format(data.current.marketValue)} M€`, label: "valor de mercado" },
    );
  }
  const facts = [data.position ? POSITION_LABEL[data.position] : null, data.number ? `Dorsal ${data.number}` : null].filter(Boolean);
  return (
    <section className="flex flex-col gap-5 card px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-center gap-5">
        <PlayerAvatar name={data.name} photoUrl={data.photoUrl} number={data.number} position={data.position} size={104} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {facts.length > 0 && <span className="text-[13px] font-bold tracking-[0.1em] text-accent-text uppercase">{facts.join(" · ")}</span>}
          <h1 className="font-display text-[44px] leading-[0.95] font-extrabold uppercase sm:text-[56px]">{data.displayName}</h1>
          {data.team && (
            <Link href={`/equipos/${data.slugs[data.team.id] ?? ""}`} className="flex items-center gap-2 self-start hover:text-accent-text">
              <Crest src={data.logos[data.team.id]} name={data.team.name} size={26} />
              <span className="font-semibold">{data.team.name}</span>
            </Link>
          )}
          {!data.name && <p className="text-sm text-muted">La liga no publica el nombre de este jugador: su ficha es privada.</p>}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-px overflow-hidden rounded-[14px] border border-line bg-line">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface px-4 py-3">
            <div className="font-display text-[30px] leading-none font-extrabold">{stat.value}</div>
            <div className="text-[13px] text-muted">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Seasons({ data }: { data: PlayerPageData }) {
  const columns = "grid-cols-[minmax(0,1fr)_repeat(4,34px)]";
  return (
    <SectionCard title="Por temporada" className="self-start">
      <div className={`grid ${columns} gap-2 px-1 pb-1 text-xs font-semibold text-muted`}>
        <span>Equipo</span>
        <span className="text-right">PJ</span>
        <span className="text-right">G</span>
        <span className="text-right">A</span>
        <span className="text-right">MVP</span>
      </div>
      {data.seasons.map((row) => (
        <Link
          key={`${row.season}-${row.teamId}`}
          href={`/equipos/${data.slugs[row.teamId] ?? ""}`}
          className={`grid ${columns} items-center gap-2 rounded-[10px] border-t border-line-soft px-1 py-2 text-sm hover:bg-canvas`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Crest src={data.logos[row.teamId]} name={row.teamName} size={24} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{row.teamName}</span>
              <span className="text-xs text-muted">{row.season}</span>
            </span>
          </span>
          <span className="text-right">{row.matches}</span>
          <span className="text-right font-bold">{row.goals}</span>
          <span className="text-right">{row.assists}</span>
          <span className="text-right">{row.cracks}</span>
        </Link>
      ))}
    </SectionCard>
  );
}

function MatchLine({ row, data }: { row: PlayerMatchRow; data: PlayerPageData }) {
  const { match } = row;
  const isHome = match.homeId === row.teamId;
  const opponentId = isHome ? match.awayId : match.homeId;
  const opponent = isHome ? match.awayName : match.homeName;
  // The score is from the player's team: their goals first. Venues are neutral,
  // so home or away is only the fixture order and is not shown.
  const own = isHome ? match.homeGoals : match.awayGoals;
  const against = isHome ? match.awayGoals : match.homeGoals;
  const events = (
    <PlayerEvents goals={row.goals} minutes={row.minutes} assists={row.assists} yellowCards={row.yellowCards} redCards={row.redCards} />
  );
  return (
    <Link
      href={`/partidos/${match.id}`}
      className="grid grid-cols-[minmax(0,1fr)_56px_28px] items-center gap-2.5 border-b border-line-soft px-1.5 py-2.5 text-sm hover:bg-canvas sm:grid-cols-[112px_minmax(0,1fr)_auto_56px_28px]"
    >
      <span className="text-[13px] whitespace-nowrap text-muted max-sm:hidden">{formatShortDate(match.date, data.now)}</span>
      {/* On mobile, the date and what they did go on a second line under the opponent. */}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-xs text-muted">vs</span>
          <Crest src={data.logos[opponentId]} name={opponent} size={24} />
          <span className="truncate">{opponent}</span>
          {row.crack && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent-text">MVP</span>}
        </span>
        <span className="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-xs sm:hidden">
          <span className="whitespace-nowrap text-muted">{formatShortDate(match.date, data.now)}</span>
          {events}
        </span>
      </span>
      <span className="max-sm:hidden">{events}</span>
      <span
        className="rounded-lg bg-canvas text-center font-display text-lg font-extrabold"
        title={match.played ? `${match.homeName} ${match.homeGoals}–${match.awayGoals} ${match.awayName}` : undefined}
      >
        {match.played ? `${own}–${against}` : "–"}
      </span>
      <span>{row.outcome && <OutcomeBadge outcome={row.outcome} size={26} />}</span>
    </Link>
  );
}
