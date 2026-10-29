import { CHAMPIONS_PHASES, type ChampionsStage } from "@/lib/sportspress/champions";

/** The Champions' four-point star, in the current colour. */
export function ChampionsStar({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={`shrink-0 ${className}`} aria-hidden>
      <path fill="currentColor" d="M10 1l2.4 6.6L19 10l-6.6 2.4L10 19l-2.4-6.6L1 10l6.6-2.4z" />
    </svg>
  );
}

/**
 * The short "Champions" label, where a navy background does not fit: a navy pill with the star.
 * On a phone only the star shows; the word stays for screen readers.
 */
export function ChampionsBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-champions p-1 text-[11px] font-extrabold tracking-[0.06em] text-on-champions uppercase sm:px-2 sm:py-0.5 ${className}`}
    >
      <ChampionsStar size={10} className="text-champions-star" />
      <span className="max-sm:sr-only">Champions</span>
    </span>
  );
}

/** The road to the final, with the match's phase lit. For a navy surface. */
export function ChampionsRoad({ stage }: { stage: ChampionsStage }) {
  return (
    <ol className="flex flex-wrap gap-1 text-xs" aria-label="Camino a la final">
      {CHAMPIONS_PHASES.map((phase) => {
        const current = phase === stage.phase;
        return (
          <li
            key={phase}
            aria-current={current ? "step" : undefined}
            className={`rounded-full border px-2.5 py-0.5 ${
              current ? "border-champions-star bg-champions-star font-bold text-champions-deep" : "border-line text-muted"
            }`}
          >
            {current && stage.round !== null ? `${phase} · J${stage.round}` : phase}
          </li>
        );
      })}
    </ol>
  );
}
