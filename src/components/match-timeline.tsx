import { Crest } from "./crest";

const MATCH_MINUTES = 50;
const HALF_MINUTES = 25;
/** Minimum gap between labels on the same side, in % of the width (~5 minutes). */
const MIN_GAP_PERCENT = 11;
const LEVELS = 5;
/** Stem height per level and label height, in px. */
const STEM_BASE = 20;
const STEM_STEP = 44;
const LABEL_HEIGHT = 36;
/** Room for a crest next to the axis on each side, in px. */
const MIN_HALF = 56;

interface TimelineGoal {
  minute: number;
  teamId: number;
  playerName: string;
  score: string;
}

interface TimelineTeam {
  id: number;
  name: string;
  logoUrl: string | null;
}

interface PlacedGoal extends TimelineGoal {
  percent: number;
  level: number;
}

const percentOf = (minute: number) => (Math.min(Math.max(minute, 0), MATCH_MINUTES) / MATCH_MINUTES) * 100;

/**
 * Places one side's goals on levels: each goal takes the lowest level whose
 * last label is far enough away, so they do not overlap.
 */
function place(goals: TimelineGoal[]): PlacedGoal[] {
  const lastPercent: number[] = Array(LEVELS).fill(-Infinity);
  return [...goals]
    .sort((a, b) => a.minute - b.minute)
    .map((goal) => {
      const percent = percentOf(goal.minute);
      let level = lastPercent.findIndex((last) => percent - last >= MIN_GAP_PERCENT);
      if (level === -1) level = lastPercent.indexOf(Math.min(...lastPercent));
      lastPercent[level] = percent;
      return { ...goal, percent, level };
    });
}

function halfHeight(goals: PlacedGoal[]) {
  if (goals.length === 0) return MIN_HALF;
  const maxLevel = Math.max(...goals.map((g) => g.level));
  return Math.max(MIN_HALF, STEM_BASE + maxLevel * STEM_STEP + LABEL_HEIGHT + 8);
}

function lastName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
}

function GoalMark({ goal, side }: { goal: PlacedGoal; side: "home" | "away" }) {
  const stem = STEM_BASE + goal.level * STEM_STEP;
  const color = side === "home" ? "bg-accent" : "bg-ink";
  // At the edges the label aligns inwards so it does not overflow.
  const align = goal.percent < 6 ? "translate-x-0 items-start text-left" : goal.percent > 94 ? "-translate-x-full items-end text-right" : "-translate-x-1/2 items-center text-center";
  return (
    <div className="absolute inset-y-0" style={{ left: `${goal.percent}%` }}>
      <span className={`absolute top-1/2 left-0 z-20 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${color}`} />
      <span
        className={`absolute left-0 w-0.5 -translate-x-1/2 ${color}`}
        style={side === "home" ? { bottom: "50%", height: stem } : { top: "50%", height: stem }}
      />
      <div
        className={`absolute left-0 z-10 flex w-max max-w-28 flex-col gap-px rounded-md bg-surface px-1 py-0.5 ${align}`}
        style={side === "home" ? { bottom: `calc(50% + ${stem + 2}px)` } : { top: `calc(50% + ${stem + 2}px)` }}
      >
        <span className="truncate text-[13px] leading-tight font-bold">{lastName(goal.playerName)}</span>
        <span className="text-xs leading-tight text-muted">
          <b className={side === "home" ? "text-accent-text" : "text-ink"}>{goal.minute}′</b> · {goal.score}
        </span>
      </div>
    </div>
  );
}

/** A team's crest at the start of its side of the axis, ringed in its colour; the name is for screen readers. */
function TeamCrest({ team, side, top }: { team: TimelineTeam; side: "home" | "away"; top: number }) {
  return (
    <span
      title={team.name}
      className={`absolute left-0 flex rounded-[9px] ring-2 ${side === "home" ? "ring-accent" : "ring-ink"}`}
      style={side === "home" ? { top: top - 46 } : { top: top + 10 }}
    >
      <Crest src={team.logoUrl} name={team.name} size={36} />
      <span className="sr-only">{team.name}</span>
    </span>
  );
}

/**
 * Match timeline: an axis from 0′ to 50′ with home goals above and away goals
 * below, each team's crest at the start of its side and the half-time score on
 * the axis.
 */
export function MatchTimeline({
  goals,
  home,
  away,
  halftime,
}: {
  goals: TimelineGoal[];
  home: TimelineTeam;
  away: TimelineTeam;
  halftime: string | null;
}) {
  const homeGoals = place(goals.filter((g) => g.teamId === home.id));
  const awayGoals = place(goals.filter((g) => g.teamId === away.id));
  const top = halfHeight(homeGoals);
  const bottom = halfHeight(awayGoals);
  const height = top + bottom;
  const ticks = [10, 20, 30, 40];

  return (
    <div className="hidden grid-cols-[36px_30px_minmax(0,1fr)_30px] lg:grid" aria-label="Línea de tiempo de los goles">
      <div className="relative" style={{ height }}>
        <TeamCrest team={home} side="home" top={top} />
        <TeamCrest team={away} side="away" top={top} />
      </div>
      <div className="relative" style={{ height }}>
        <span className="absolute right-1.5 -translate-y-1/2 text-[11px] font-semibold text-muted" style={{ top }}>
          0′
        </span>
      </div>

      <div className="relative" style={{ height }}>
        {/* Axis, a tick every 10 minutes and the half-time score */}
        <div className="absolute inset-x-0 h-0.5 -translate-y-1/2 rounded-full bg-ink/20" style={{ top }} />
        {ticks.map((minute) => (
          <span
            key={minute}
            className="absolute h-[7px] w-px -translate-x-1/2 -translate-y-1/2 bg-ink/25"
            style={{ top, left: `${percentOf(minute)}%` }}
          />
        ))}
        <span
          className="absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap"
          style={{ top, left: `${percentOf(HALF_MINUTES)}%` }}
        >
          {halftime ? `Desc. ${halftime}` : "Descanso"}
        </span>

        {/* Goals: home above, away below */}
        <div className="absolute inset-x-0 top-0" style={{ height: top * 2 }}>
          {homeGoals.map((goal, index) => (
            <GoalMark key={`h${index}`} goal={goal} side="home" />
          ))}
        </div>
        <div className="absolute inset-x-0" style={{ top: top - bottom, height: bottom * 2 }}>
          {awayGoals.map((goal, index) => (
            <GoalMark key={`a${index}`} goal={goal} side="away" />
          ))}
        </div>
      </div>

      <div className="relative" style={{ height }}>
        <span className="absolute left-1.5 -translate-y-1/2 text-[11px] font-semibold text-muted" style={{ top }}>
          50′
        </span>
      </div>
    </div>
  );
}
