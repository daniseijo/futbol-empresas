import Link from "next/link";
import { Suspense } from "react";
import { Crest } from "@/components/crest";
import { FormBadges } from "@/components/form-badges";
import { PlayerAvatar } from "@/components/player-avatar";
import { siteConfig } from "@/config/site";
import { formatLongDate, formatNewsDate, formatShortDate, relativeDay } from "@/lib/dates";
import { getTeams } from "@/lib/data";
import { getVenue } from "@/lib/sportspress/venues";
import { getHomeData, type CompetitionCard, type FocusBlock, type HomeData } from "@/lib/views/home";

const numberFormat = new Intl.NumberFormat("es-ES");
const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-wrap gap-5 px-4 pt-7 sm:px-6" aria-busy="true">
      <div className="h-[520px] min-w-0 flex-[999_1_640px] animate-pulse rounded-[22px] bg-line" />
      <div className="h-[520px] min-w-0 flex-[1_1_340px] animate-pulse rounded-[22px] bg-accent-soft" />
    </div>
  );
}

async function HomeContent() {
  const [data, teams] = await Promise.all([getHomeData(), getTeams()]);
  const logos = Object.fromEntries(teams.map((t) => [t.id, t.logoUrl]));

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-7 px-4 pt-7 sm:px-6">
      <section className="flex flex-wrap items-start gap-5">
        <DayCard day={data.day} today={data.now} />
        {data.focus && <FocusCard focus={data.focus} logos={logos} now={data.now} />}
      </section>

      <LeagueNumbers data={data} />

      <section className="flex flex-col gap-3.5">
        <SectionTitle>Competiciones {data.season.name}</SectionTitle>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
          {data.competitions.map((competition) => (
            <CompetitionTile key={competition.id} competition={competition} />
          ))}
        </div>
      </section>

      {data.groupLeaders.length > 0 && (
        <section className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <SectionTitle>
              {data.mainCompetition.name} · líderes de los {data.groupLeaders.length} grupos
            </SectionTitle>
            {data.groupsPhase && <span className="text-sm text-muted">{data.groupsPhase}</span>}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
            {data.groupLeaders.map((group) => (
              <Link
                key={group.groupId}
                href={group.href}
                className={`flex flex-col gap-1 rounded-2xl border px-3.5 py-3 ${
                  group.isFocusGroup ? "border-accent bg-accent-soft text-accent-text" : "border-line bg-surface hover:border-ink"
                }`}
              >
                <span className={`flex justify-between text-xs font-semibold ${group.isFocusGroup ? "" : "text-muted"}`}>
                  <span>{group.groupName.toUpperCase()}</span>
                  <span>{group.points} pts</span>
                </span>
                <span className="truncate text-[15px] font-bold">{group.leader}</span>
                <span className={`text-xs ${group.isFocusGroup ? "" : "text-muted"}`}>
                  {group.isFocusGroup && group.focusPosition ? `Tu equipo va ${group.focusPosition}º` : "Líder"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-wrap gap-5">
        <Panel title={`Pichichi · ${data.mainCompetition.name}`} className="flex-[1_1_380px]">
          {data.scorers.map((scorer, index) => (
            <div key={scorer.playerId} className="grid grid-cols-[24px_40px_1fr_40px] items-center gap-2.5 border-t border-line-soft py-2">
              <span className="text-center text-sm text-muted">{index + 1}</span>
              <PlayerAvatar name={scorer.name} photoUrl={scorer.photoUrl} number={null} position={null} size={36} />
              <span className="flex flex-col">
                <span className="font-semibold">{scorer.name}</span>
                <span className="text-xs text-muted">{scorer.team}</span>
              </span>
              <span className="text-right font-display text-[26px] font-extrabold">{scorer.goals}</span>
            </div>
          ))}
        </Panel>

        <Panel title="Goleadas de la semana" className="flex-[1_1_380px]">
          {data.week.bigWins.map((win) => (
            <div key={win.id} className="grid grid-cols-[1fr_72px_1fr] items-center gap-2.5 border-t border-line-soft py-3">
              <span className={`text-right ${win.homeGoals > win.awayGoals ? "font-bold" : ""}`}>{win.home}</span>
              <span className="rounded-[10px] bg-accent-soft text-center font-display text-[26px] font-extrabold text-accent-text">
                {win.homeGoals}–{win.awayGoals}
              </span>
              <span className={win.awayGoals > win.homeGoals ? "font-bold" : ""}>{win.away}</span>
            </div>
          ))}
          <p className="pt-2.5 text-sm text-muted">
            Del {formatShortDate(data.week.from)} al {formatShortDate(data.week.to)}: {data.week.matches} partidos y{" "}
            {numberFormat.format(data.week.goals)} goles
            {data.week.matches > 0 && `, ${decimal.format(data.week.goals / data.week.matches)} por partido`}.
          </p>
        </Panel>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5">
          {data.news && (
            <a href={data.news.url} className="flex flex-col gap-2.5 rounded-[20px] bg-ink p-5 text-white">
              <span className="text-xs font-bold tracking-[0.1em] text-[#c7cdd6]">NOTICIA · {formatNewsDate(data.news.date).toUpperCase()}</span>
              <span className="font-display text-[30px] leading-[1.02] font-extrabold">{data.news.title}</span>
            </a>
          )}
          <a href={siteConfig.youtubeChannel} className="flex items-center gap-3.5 rounded-[20px] border border-line bg-surface p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" className="fill-on-accent" aria-hidden="true">
                <path d="M7 4l13 8-13 8z" />
              </svg>
            </span>
            <span>
              <b>Canal de YouTube</b>
              <br />
              <span className="text-sm text-muted">Golazo del mes y resúmenes</span>
            </span>
          </a>
        </div>
      </section>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-[34px] leading-none font-extrabold uppercase">{children}</h2>;
}

function Panel({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 rounded-[20px] border border-line bg-surface p-5 ${className}`}>
      <h2 className="mb-2 font-display text-[28px] font-extrabold uppercase">{title}</h2>
      {children}
    </div>
  );
}

function DayCard({ day, today }: { day: HomeData["day"]; today: string }) {
  const heading = day.isToday ? `Hoy · ${formatLongDate(day.date)}` : `${relativeDay(day.date, today)} · ${formatLongDate(day.date)}`;
  return (
    <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-4.5 rounded-[22px] border border-line bg-surface p-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-bold tracking-[0.1em] text-accent-text uppercase">{heading}</div>
          <h1 className="mt-1 font-display text-[44px] leading-[0.95] font-extrabold sm:text-[56px]">
            {day.matches.length} PARTIDOS EN {day.venues} {day.venues === 1 ? "CAMPO" : "CAMPOS"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {day.labels.map((label) => (
            <span key={label} className="rounded-full border border-line bg-canvas px-2.5 py-1.5 text-[13px]">
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-7">
        {day.matches.map((match) => (
          <Link
            href={`/partidos/${match.id}`}
            key={match.id}
            className={`grid grid-cols-[48px_1fr_44px] items-center gap-2.5 border-b border-line-soft px-2.5 py-2 ${
              match.isFocus ? "rounded-[10px] border-transparent bg-accent text-on-accent" : "hover:bg-canvas"
            }`}
          >
            <span className={`text-[13px] font-semibold ${match.isFocus ? "" : "text-accent-text"}`}>{match.time}</span>
            <span className="flex min-w-0 flex-col">
              <span className={`truncate text-sm ${match.isFocus ? "font-bold" : "font-medium"}`}>
                {match.home} – {match.away}
              </span>
              <span className={`truncate text-xs ${match.isFocus ? "" : "text-muted"}`}>
                {match.venue}
                {match.label ? ` · ${match.label}` : ""}
              </span>
            </span>
            <span className="text-right font-display text-lg font-bold">
              {match.homeGoals !== null ? `${match.homeGoals}–${match.awayGoals}` : ""}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function FocusCard({ focus, logos, now }: { focus: FocusBlock; logos: Record<number, string | null>; now: string }) {
  const team = focus.row;
  const next = focus.nextMatch;
  const venue = next ? getVenue(next.venueId) : null;
  const teamName = team?.name ?? "Mi equipo";
  return (
    <Link
      href={`/equipos/${siteConfig.focusTeamSlug}`}
      className="flex min-w-0 flex-[1_1_340px] flex-col gap-4.5 rounded-[22px] bg-accent p-6 text-on-accent"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-[0.12em]">TU EQUIPO</span>
        <span className="text-[13px] font-semibold">Ver equipo →</span>
      </div>
      <div className="flex items-center gap-3.5">
        <Crest src={logos[focus.teamId]} name={teamName} size={64} />
        <div>
          <div className="font-display text-[52px] leading-[0.9] font-extrabold uppercase">{teamName}</div>
          {focus.group && (
            <div className="text-[13px] font-medium">
              {focus.group.competition} · {focus.group.name}
            </div>
          )}
        </div>
      </div>

      {team && (
        <div className="grid grid-cols-3 gap-2">
          <Stat value={`${team.position}º`} label={`de ${focus.standings.length}`} />
          <Stat value={String(team.points)} label="puntos" />
          <div className="rounded-xl bg-ink/10 px-3 py-2.5">
            <div className="flex h-8 items-center">
              <FormBadges form={team.form.slice(-3)} size={24} />
            </div>
            <div className="text-xs">forma</div>
          </div>
        </div>
      )}

      {next && (
        <div className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 text-ink">
          <div className="flex justify-between text-xs font-bold tracking-[0.08em] text-accent-text uppercase">
            <span>
              {relativeDay(next.date, now)} · {next.date.slice(11, 16)}
            </span>
            {next.round && <span>Jornada {next.round}</span>}
          </div>
          <div className="flex items-center gap-2.5">
            <Crest src={logos[next.homeId === focus.teamId ? next.awayId : next.homeId]} name={next.homeId === focus.teamId ? next.awayName : next.homeName} size={36} />
            <span className="flex-1 font-bold">
              {next.homeName} – {next.awayName}
            </span>
            {team && focus.nextOpponent && (
              <span className="text-xs text-muted">
                {next.homeId === focus.teamId ? `${team.position}º vs ${focus.nextOpponent.position}º` : `${focus.nextOpponent.position}º vs ${team.position}º`}
              </span>
            )}
          </div>
          {venue && (
            <div className="text-[13px] text-muted">
              {venue.name}
              {venue.address ? ` · ${venue.address}` : ""}
            </div>
          )}
        </div>
      )}

      {focus.lastResults.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-bold tracking-[0.1em]">ÚLTIMOS RESULTADOS</div>
          {focus.lastResults.slice(0, 2).map((match) => (
            <div key={match.id} className="flex items-center gap-2.5 rounded-xl bg-ink/10 px-3 py-2 text-sm">
              <span className="w-7 font-bold">{match.round ? `J${match.round}` : ""}</span>
              <span className="flex-1">
                {match.homeName} – {match.awayName}
              </span>
              <b>
                {match.homeGoals}–{match.awayGoals}
              </b>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {focus.topScorer && (
          <div className="rounded-xl bg-ink/10 px-3 py-2.5">
            <div className="text-[11px] font-bold tracking-[0.08em]">GOLEADOR</div>
            <div className="text-[15px] font-bold">
              {focus.topScorer.name} · {focus.topScorer.goals}
            </div>
          </div>
        )}
        {focus.mostValuable && (
          <div className="rounded-xl bg-ink/10 px-3 py-2.5">
            <div className="text-[11px] font-bold tracking-[0.08em]">MÁS VALIOSO</div>
            <div className="text-[15px] font-bold">
              {focus.mostValuable.name.split(" ").slice(-1)[0]} · {money.format(focus.mostValuable.value)} M€
            </div>
          </div>
        )}
      </div>

      {focus.zone.length > 0 && focus.group && (
        <div className="flex flex-col gap-1">
          <div className="text-xs font-bold tracking-[0.1em] uppercase">Zona del {focus.group.name}</div>
          {focus.zone.map((row) => (
            <div
              key={row.teamId}
              className={`flex justify-between text-sm ${row.teamId === focus.teamId ? "rounded-lg bg-white px-2 py-1.5 font-bold text-ink" : "px-0.5 py-1"}`}
            >
              <span>
                {row.position}º {row.name}
              </span>
              <b>{row.points}</b>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-ink/10 px-3 py-2.5">
      <div className="font-display text-[32px] leading-none font-extrabold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

function LeagueNumbers({ data }: { data: HomeData }) {
  const { mainCompetition: main } = data;
  const items = [
    { value: numberFormat.format(main.teams), label: `equipos en la ${main.name}` },
    { value: numberFormat.format(main.groups), label: "grupos" },
    { value: numberFormat.format(main.played), label: "partidos jugados" },
    { value: numberFormat.format(main.goals), label: "goles" },
    { value: main.played ? decimal.format(main.goals / main.played) : "—", label: "goles por partido" },
    { value: numberFormat.format(main.venues), label: "campos" },
  ];
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-px overflow-hidden rounded-[18px] border border-line bg-line">
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-5 py-4">
          <div className="font-display text-[40px] leading-none font-extrabold">{item.value}</div>
          <div className="text-[13px] text-muted">{item.label}</div>
        </div>
      ))}
    </section>
  );
}

const STATUS: Record<CompetitionCard["status"], { label: string; className: string }> = {
  live: { label: "EN JUEGO", className: "bg-accent text-on-accent" },
  starting: { label: "EMPIEZA", className: "bg-accent text-on-accent" },
  upcoming: { label: "PRÓXIMAMENTE", className: "bg-line-soft text-[#3a4350]" },
  finished: { label: "TERMINADA", className: "bg-ink text-white" },
};

function CompetitionTile({ competition }: { competition: CompetitionCard }) {
  const status = STATUS[competition.status];
  const showBar = competition.status === "live" || competition.status === "starting";
  return (
    <Link href={competition.href} className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface p-4.5 hover:border-ink">
      <span className={`self-start rounded-md px-2 py-1 text-[11px] font-bold tracking-[0.08em] ${status.className}`}>{status.label}</span>
      <span className="font-display text-[26px] leading-none font-extrabold">{competition.name}</span>
      <span className="text-[13px] leading-[1.45] text-muted">{competition.description}</span>
      {showBar && competition.total > 0 && (
        <span className="mt-auto flex flex-col gap-1.5">
          <span className="block h-1.5 rounded-full bg-line-soft">
            <span
              className="block h-1.5 rounded-full bg-accent"
              style={{ width: `${Math.round((competition.played / competition.total) * 100)}%` }}
            />
          </span>
          <span className="text-xs text-muted">
            {competition.played} de {competition.total} partidos jugados
          </span>
        </span>
      )}
    </Link>
  );
}
