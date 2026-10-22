import { Crest } from "./crest";

const MATCH_MINUTES = 50;
const HALF_MINUTES = 25;
/** Separación mínima entre etiquetas del mismo lado, en % del ancho (~5 minutos). */
const MIN_GAP_PERCENT = 10;
const LEVELS = 3;
/** Alturas de la varilla por nivel y de la etiqueta, en px. */
const STEM_BASE = 22;
const STEM_STEP = 54;
const LABEL_HEIGHT = 50;

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
 * Coloca los goles de un lado en niveles: cada gol usa el nivel más bajo cuya
 * última etiqueta queda lo bastante lejos, para que no se pisen.
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
  const maxLevel = Math.max(0, ...goals.map((g) => g.level));
  return STEM_BASE + maxLevel * STEM_STEP + LABEL_HEIGHT + 8;
}

function lastName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
}

function GoalMark({ goal, side }: { goal: PlacedGoal; side: "home" | "away" }) {
  const stem = STEM_BASE + goal.level * STEM_STEP;
  const color = side === "home" ? "bg-accent" : "bg-ink";
  // En los extremos la etiqueta se alinea hacia dentro para no salirse.
  const align = goal.percent < 6 ? "translate-x-0 items-start text-left" : goal.percent > 94 ? "-translate-x-full items-end text-right" : "-translate-x-1/2 items-center text-center";
  return (
    <div className="absolute inset-y-0" style={{ left: `${goal.percent}%` }}>
      <span className={`absolute top-1/2 left-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${color}`} />
      <span
        className={`absolute left-0 w-0.5 -translate-x-1/2 ${color}`}
        style={side === "home" ? { bottom: "50%", height: stem } : { top: "50%", height: stem }}
      />
      <div
        className={`absolute left-0 z-10 flex w-max max-w-28 flex-col gap-0.5 rounded-md bg-surface px-1 py-0.5 ${align}`}
        style={side === "home" ? { bottom: `calc(50% + ${stem + 4}px)` } : { top: `calc(50% + ${stem + 4}px)` }}
      >
        <span
          className={`rounded px-1.5 py-px text-[10px] font-extrabold tracking-[0.08em] ${
            side === "home" ? "bg-accent text-on-accent" : "bg-ink text-white"
          }`}
        >
          GOL
        </span>
        <span className="truncate text-[13px] leading-tight font-bold">{lastName(goal.playerName)}</span>
        <span className="text-xs leading-tight text-muted">
          {goal.minute}′ · {goal.score}
        </span>
      </div>
    </div>
  );
}

/**
 * Línea de tiempo del partido: un eje de 0′ a 50′ con los goles del local
 * hacia arriba y los del visitante hacia abajo.
 */
export function MatchTimeline({
  goals,
  home,
  away,
  halftime,
  finalScore,
}: {
  goals: TimelineGoal[];
  home: TimelineTeam;
  away: TimelineTeam;
  halftime: string | null;
  finalScore: string;
}) {
  const homeGoals = place(goals.filter((g) => g.teamId === home.id));
  const awayGoals = place(goals.filter((g) => g.teamId === away.id));
  const top = halfHeight(homeGoals);
  const bottom = halfHeight(awayGoals);
  const ticks = Array.from({ length: MATCH_MINUTES / 5 + 1 }, (_, i) => i * 5);

  return (
    <div className="hidden grid-cols-[170px_minmax(0,1fr)] gap-x-6 lg:grid" aria-label="Línea de tiempo de los goles">
      <div className="grid" style={{ gridTemplateRows: `${top}px ${bottom}px` }}>
        {[home, away].map((team, index) => (
          <div key={team.id} className={`flex min-w-0 items-center gap-2.5 ${index === 0 ? "self-end pb-6" : "self-start pt-6"}`}>
            <Crest src={team.logoUrl} name={team.name} size={26} />
            <span className="truncate text-sm font-semibold">{team.name}</span>
            <span className={`size-2 shrink-0 rounded-full ${index === 0 ? "bg-accent" : "bg-ink"}`} />
          </div>
        ))}
      </div>

      <div className="relative" style={{ height: top + bottom }}>
        {/* Eje y marcas cada 5 minutos */}
        <div className="absolute inset-x-0 h-0.5 -translate-y-1/2 rounded-full bg-ink/25" style={{ top }} />
        {ticks.map((minute) => (
          <div key={minute} className="absolute" style={{ top, left: `${percentOf(minute)}%` }}>
            <span
              className={`absolute left-0 -translate-x-1/2 -translate-y-1/2 ${minute === HALF_MINUTES ? "h-5 w-0.5 bg-ink/40" : minute % 25 === 0 ? "h-3 w-px bg-ink/25" : "h-1.5 w-px bg-ink/25"}`}
            />
          </div>
        ))}

        {/* Goles: el local arriba, el visitante abajo */}
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

      {/* Eje: inicio, descanso y final, en su propia fila para que no se pisen con los goles */}
      <span />
      <div className="relative mt-2 h-5 border-t border-line-soft pt-1.5 text-xs text-muted">
        <span className="absolute left-0">0′ · Inicio</span>
        <span className="absolute -translate-x-1/2 font-semibold whitespace-nowrap text-ink" style={{ left: `${percentOf(HALF_MINUTES)}%` }}>
          25′ · Descanso{halftime ? ` ${halftime}` : ""}
        </span>
        <span className="absolute right-0 font-semibold text-ink">Final {finalScore} · 50′</span>
      </div>
    </div>
  );
}
