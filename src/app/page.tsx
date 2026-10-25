import Link from "next/link";
import { Suspense } from "react";
import { Crest } from "@/components/crest";
import { DayMatchCard } from "@/components/day-match-card";
import { Eyebrow, FeaturedFooter, FeaturedHero } from "@/components/featured-match";
import { FormBadges } from "@/components/form-badges";
import { PlayerAvatar } from "@/components/player-avatar";
import { StandingsZone } from "@/components/team/standings-table";
import { SectionCard } from "@/components/team/section-card";
import { siteConfig } from "@/config/site";
import { capitalize, daysBetween, formatLongDate, formatNewsDate, formatShortDate } from "@/lib/dates";
import { getTeams } from "@/lib/data";
import { getHomeData, type CompetitionCard, type FocusBlock, type HomeData } from "@/lib/views/home";

const numberFormat = new Intl.NumberFormat("es-ES");
const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Logos = Record<number, string | null>;
type Slugs = Record<number, string>;

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-9 px-4 pt-7 sm:px-6" aria-busy="true">
      <div className="h-[560px] animate-pulse rounded-[22px] bg-line" />
      <div className="h-[180px] animate-pulse rounded-[22px] bg-line-soft" />
    </div>
  );
}

async function HomeContent() {
  const [data, teams] = await Promise.all([getHomeData(), getTeams()]);
  const logos: Logos = Object.fromEntries(teams.map((t) => [t.id, t.logoUrl]));
  const slugs: Slugs = Object.fromEntries(teams.map((t) => [t.id, t.slug]));

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-9 px-4 pt-7 sm:px-6">
      {data.focus && <FocusSection focus={data.focus} logos={logos} slugs={slugs} now={data.now} />}

      {data.day.matches.length > 0 && <DayStrip day={data.day} now={data.now} logos={logos} />}

      <div className="flex flex-wrap items-start gap-5">
        <SectionCard title="Máximos goleadores" aside={<span className="text-sm text-muted">{data.mainCompetition.name}</span>} className="flex-[1_1_340px]">
          <div>
            {data.scorers.map((scorer, index) => (
              <Link
                key={scorer.playerId}
                href={`/jugadores/${scorer.playerId}`}
                className="grid grid-cols-[20px_36px_minmax(0,1fr)_36px] items-center gap-2.5 border-t border-line-soft py-2 hover:bg-canvas"
              >
                <span className="text-center text-sm text-muted">{index + 1}</span>
                <PlayerAvatar name={scorer.name} photoUrl={scorer.photoUrl} number={null} position={null} size={36} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{scorer.name}</span>
                  <span className="truncate text-xs text-muted">{scorer.team}</span>
                </span>
                <span className="text-right font-display text-[26px] font-extrabold">{scorer.goals}</span>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Goleadas de la semana"
          aside={
            <span className="text-sm text-muted">
              {formatShortDate(data.week.from)} – {formatShortDate(data.week.to)}
            </span>
          }
          className="flex-[1_1_340px]"
        >
          <div>
            {data.week.bigWins.map((win) => (
              <Link
                key={win.id}
                href={`/partidos/${win.id}`}
                className="grid grid-cols-[minmax(0,1fr)_68px_minmax(0,1fr)] items-center gap-2.5 border-t border-line-soft py-2.5 text-sm hover:bg-canvas"
              >
                <span className={`text-right ${win.homeGoals > win.awayGoals ? "font-bold" : ""}`}>{win.home}</span>
                <span className="rounded-[10px] bg-accent-soft text-center font-display text-[22px] font-extrabold text-accent-text">
                  {win.homeGoals}–{win.awayGoals}
                </span>
                <span className={win.awayGoals > win.homeGoals ? "font-bold" : ""}>{win.away}</span>
              </Link>
            ))}
          </div>
          <p className="text-sm text-muted">
            {data.week.matches} partidos y {numberFormat.format(data.week.goals)} goles
            {data.week.matches > 0 && `, ${decimal.format(data.week.goals / data.week.matches)} por partido`}.
          </p>
        </SectionCard>

        <SectionCard title="Competiciones" aside={<span className="text-sm text-muted">{data.season.name}</span>} className="flex-[1_1_340px]">
          <div>
            {data.competitions.map((competition) => (
              <CompetitionRow key={competition.id} competition={competition} main={data.mainCompetition} />
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        {data.groupLeaders.length > 0 && (
          <section className="flex min-w-0 flex-[999_1_640px] flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-[28px] leading-tight font-extrabold uppercase">
                Líderes de los {data.groupLeaders.length} grupos
              </h2>
              <span className="text-sm text-muted">
                {data.mainCompetition.name}
                {data.groupsPhase && ` · ${data.groupsPhase}`}
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
              {data.groupLeaders.map((group) => (
                <Link
                  key={group.groupId}
                  href={group.href}
                  className={`flex flex-col gap-0.5 rounded-[14px] border px-3 py-2.5 ${
                    group.isFocusGroup ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-ink"
                  }`}
                >
                  <span className={`flex justify-between text-xs font-semibold ${group.isFocusGroup ? "text-accent-text" : "text-muted"}`}>
                    <span>{group.groupName}</span>
                    <span>{group.points} pts</span>
                  </span>
                  <span className="truncate text-sm font-bold">{group.leader}</span>
                  {group.isFocusGroup && group.focusPosition && (
                    <span className="text-xs font-semibold text-accent-text">Tu equipo va {group.focusPosition}º</span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
          {data.news && (
            <a href={data.news.url} className="flex flex-col gap-2.5 rounded-[20px] bg-ink p-5 text-white">
              <span className="text-xs font-bold tracking-[0.1em] text-[#c7cdd6]">NOTICIA · {formatNewsDate(data.news.date).toUpperCase()}</span>
              <span className="font-display text-[28px] leading-[1.02] font-extrabold">{data.news.title}</span>
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
      </div>
    </main>
  );
}

// ——— Your team ———

function FocusSection({ focus, logos, slugs, now }: { focus: FocusBlock; logos: Logos; slugs: Slugs; now: string }) {
  const team = focus.row;
  const teamName = team?.name ?? focus.matches[0]?.homeName ?? "Mi equipo";
  const base = `/equipos/${siteConfig.focusTeamSlug}`;
  const featured = focus.featured;

  return (
    <section aria-labelledby="tu-equipo" className="card flex flex-col overflow-hidden max-sm:-mt-7 max-sm:border-t-0">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3.5 bg-accent px-4 py-4.5 text-on-accent sm:px-7">
        <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3.5">
          <Crest src={logos[focus.teamId]} name={teamName} size={56} />
          <div className="min-w-0">
            <div className="text-xs font-bold tracking-[0.12em]">TU EQUIPO</div>
            <h2 id="tu-equipo" className="font-display text-[40px] leading-[0.9] font-extrabold uppercase sm:text-[46px]">
              {teamName}
            </h2>
            {focus.group && (
              <div className="mt-0.5 text-[13px] font-medium">
                {[focus.group.competition, focus.group.phase, focus.group.name].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>
        {team && (
          <div className="flex flex-wrap gap-2">
            <Stat value={`${team.position}º`} label={`de ${focus.standings.length}`} />
            <Stat value={String(team.points)} label={team.points === 1 ? "punto" : "puntos"} />
            <Stat value={`${team.goalsFor}–${team.goalsAgainst}`} label="goles" />
            <div className="rounded-xl bg-ink/10 px-3.5 py-2">
              <div className="flex h-7 items-center">
                <FormBadges form={team.form.slice(-3)} size={22} />
              </div>
              <div className="text-xs">racha</div>
            </div>
          </div>
        )}
        <Link href={base} className="text-sm font-semibold whitespace-nowrap hover:underline">
          Ver equipo →
        </Link>
      </div>

      <div className="flex flex-wrap">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5 px-4 py-6 sm:px-7">
          <FeaturedHero team={focus} logos={logos} slugs={slugs} now={now} teamPath={base} />
        </div>

        {focus.group && focus.standings.length > 0 && (
          <aside
            aria-label={`Clasificación del ${focus.group.name}`}
            className="flex min-w-0 flex-[1_1_360px] flex-col gap-5 border-t border-line-soft px-4 py-5.5 sm:px-6 min-[930px]:border-t-0 min-[930px]:border-l"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h3 className="font-bold">{focus.group.name}</h3>
                <Link href={`${base}/clasificacion`} className="text-[13px] font-semibold text-accent-text hover:underline">
                  Clasificación
                </Link>
              </div>
              <StandingsZone rows={focus.standings} teamId={focus.teamId} logos={logos} slugs={slugs} size={focus.standings.length} />
            </div>
            {focus.mode === "preview" && featured && featured.round.length > 0 && (
              <div className="flex flex-col">
                <h3 className="mb-1 text-sm font-bold">Resto de la jornada{"\u00a0"}{featured.match.round}</h3>
                {featured.round.map((match) => (
                  <Link
                    key={match.id}
                    href={`/partidos/${match.id}`}
                    className="flex justify-between gap-2 border-t border-line-soft py-1.5 text-[13px] hover:bg-canvas"
                  >
                    <span className="truncate">
                      {match.homeName} – {match.awayName}
                    </span>
                    <span className="text-muted">{match.played ? `${match.homeGoals}–${match.awayGoals}` : match.date.slice(11, 16)}</span>
                  </Link>
                ))}
                {featured.restingTeam && <span className="border-t border-line-soft py-1.5 text-[13px] text-muted">Descansa {featured.restingTeam}</span>}
              </div>
            )}
          </aside>
        )}
      </div>

      <FeaturedFooter team={focus} />
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-16 rounded-xl bg-ink/10 px-3.5 py-2">
      <div className="font-display text-[28px] leading-none font-extrabold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}


// ——— Matches of the day ———

function DayStrip({ day, now, logos }: { day: HomeData["day"]; now: string; logos: Logos }) {
  const eyebrow =
    day.when === "today" ? "Hoy" : day.when === "past" ? "Últimos partidos" : daysBetween(now, day.date) === 1 ? "Mañana" : "Próximos partidos";
  const count = day.matches.length;
  return (
    <section aria-labelledby="partidos-del-dia" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 id="partidos-del-dia" className="mt-1 font-display text-[34px] leading-none font-extrabold uppercase sm:text-[40px]">
            {capitalize(formatLongDate(day.date))}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {count} {count === 1 ? "partido" : "partidos"} en {day.venues} {day.venues === 1 ? "campo" : "campos"}
            {day.competition && ` · ${day.competition}`}
          </p>
        </div>
        {count > 1 && (
          <Link href={`/partidos/dia/${day.date}`} className="text-sm font-semibold text-accent-text hover:underline">
            Ver los {count} →
          </Link>
        )}
      </div>
      <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6">
        {day.matches.map((match) => (
          <DayMatchCard key={match.id} match={match} logos={logos} className="w-56 shrink-0 snap-start" />
        ))}
      </div>
    </section>
  );
}

// ——— Competitions ———

const STATUS: Record<CompetitionCard["status"], string> = {
  live: "En juego",
  starting: "Empieza",
  upcoming: "Próximamente",
  finished: "Terminada",
};

function CompetitionRow({ competition, main }: { competition: CompetitionCard; main: HomeData["mainCompetition"] }) {
  const active = competition.status === "live" || competition.status === "starting";
  const description = competition.description.replace(/\.$/, "");
  if (!active) {
    return (
      <Link href={competition.href} className="flex flex-col gap-0.5 border-t border-line-soft py-2.5 hover:bg-canvas">
        <span className="flex justify-between gap-2 text-sm">
          <span>{competition.name}</span>
          <span className="shrink-0 text-xs text-muted">{STATUS[competition.status]}</span>
        </span>
        {competition.status === "finished" && <span className="text-xs text-muted">{description}</span>}
      </Link>
    );
  }
  const details = [competition.total > 0 && `${competition.played} de ${competition.total} partidos`, description];
  if (competition.id === main.id && main.played > 0) details.push(`${decimal.format(main.goals / main.played)} goles por partido`);
  return (
    <Link href={competition.href} className="flex flex-col gap-1.5 border-t border-line-soft py-2.5 hover:bg-canvas">
      <span className="flex justify-between gap-2">
        <b className="text-sm">{competition.name}</b>
        <span className="shrink-0 text-xs font-bold text-accent-text">{STATUS[competition.status]}</span>
      </span>
      {competition.total > 0 && (
        <span className="block h-1.5 rounded-full bg-line-soft">
          <span className="block h-1.5 rounded-full bg-accent" style={{ width: `${Math.round((competition.played / competition.total) * 100)}%` }} />
        </span>
      )}
      <span className="text-xs text-muted">{details.filter(Boolean).join(" · ")}</span>
    </Link>
  );
}
