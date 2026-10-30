import { cardsFor, sendingOff, type CardKind } from "@/lib/cards";

const CARD_LABEL: Record<CardKind, string> = {
  yellow: "Amarilla",
  red: "Roja directa",
  "second-yellow": "Doble amarilla",
};

const CARD_SHAPE = "h-3 w-[9px] rounded-[2px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.18)]";

/** A card as the referee shows it; the second yellow, a yellow behind a red. */
export function CardIcon({ kind }: { kind: CardKind }) {
  const label = CARD_LABEL[kind];
  if (kind === "second-yellow") {
    return (
      <span role="img" aria-label={label} title={label} className="relative inline-block h-3 w-[14px] shrink-0">
        <span className={`absolute top-0 left-0 bg-card-yellow ${CARD_SHAPE}`} />
        <span className={`absolute top-0 left-[5px] bg-card-red ${CARD_SHAPE}`} />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-block shrink-0 ${CARD_SHAPE} ${kind === "yellow" ? "bg-card-yellow" : "bg-card-red"}`}
    />
  );
}

// The ball and the boot are Material Design Icons' "soccer" and "shoe-cleat" (Apache 2.0).

/** A goal, as a football. */
export function GoalIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`inline-block h-3 w-3 shrink-0 fill-current ${className}`}>
      <path d="M16.93 17.12L16.13 15.76L17.59 11.39L19 10.92L20 11.67C20 11.7 20 11.75 20 11.81C20 11.88 20.03 11.94 20.03 12C20.03 13.97 19.37 15.71 18.06 17.21L16.93 17.12M9.75 15L8.38 10.97L12 8.43L15.62 10.97L14.25 15H9.75M12 20.03C11.12 20.03 10.29 19.89 9.5 19.61L8.81 18.1L9.47 17H14.58L15.19 18.1L14.5 19.61C13.71 19.89 12.88 20.03 12 20.03M5.94 17.21C5.41 16.59 4.95 15.76 4.56 14.75C4.17 13.73 3.97 12.81 3.97 12C3.97 11.94 4 11.88 4 11.81C4 11.75 4 11.7 4 11.67L5 10.92L6.41 11.39L7.87 15.76L7.07 17.12L5.94 17.21M11 5.29V6.69L7 9.46L5.66 9.04L5.24 7.68C5.68 7 6.33 6.32 7.19 5.66S8.87 4.57 9.65 4.35L11 5.29M14.35 4.35C15.13 4.57 15.95 5 16.81 5.66C17.67 6.32 18.32 7 18.76 7.68L18.34 9.04L17 9.47L13 6.7V5.29L14.35 4.35M4.93 4.93C3 6.89 2 9.25 2 12S3 17.11 4.93 19.07 9.25 22 12 22 17.11 21 19.07 19.07 22 14.75 22 12 21 6.89 19.07 4.93 14.75 2 12 2 6.89 3 4.93 4.93Z" />
    </svg>
  );
}

/** An assist, as a football boot. Its view box is cropped to the boot, which fills only the middle of the icon. */
export function AssistIcon() {
  return (
    <svg viewBox="2 5.5 20 14" aria-hidden className="inline-block h-[11px] w-4 shrink-0 fill-current">
      <path d="M21 8C20.76 8 20.53 8 20.3 8L20.25 7.97C18.14 7.84 16.38 7.17 15.53 6.23L14 7C13.95 7.1 13.89 7.19 13.84 7.28C14.55 7.89 15 8.65 15 9.5C15 9.83 14.91 10.14 14.79 10.45L12.92 8.58C12.7 8.83 12.47 9.07 12.22 9.29L14.25 11.32C14.04 11.57 13.8 11.79 13.5 12L11.43 9.91C11.14 10.11 10.85 10.28 10.55 10.45L12.58 12.5C12.25 12.63 11.89 12.74 11.5 12.82L9.59 10.91C9.25 11.05 8.91 11.18 8.56 11.29L10.26 13C10.17 13 10.09 13 10 13C8.5 13 7.2 12.54 6.28 11.82C5.46 11.95 4.68 12 4 12C2 12 2 15 2 15V15C2 16.11 2.89 17 4 17H4V18C4 18.55 4.45 19 5 19S6 18.55 6 18V17H7V18C7 18.55 7.45 19 8 19S9 18.55 9 18V17H10V18C10 18.55 10.45 19 11 19S12 18.55 12 18V17H15V18C15 18.55 15.45 19 16 19S17 18.55 17 18V17H18V18C18 18.55 18.45 19 19 19S20 18.55 20 18V17H21C21 17 22 17 22 12.5C22 9 21 8 21 8Z" />
    </svg>
  );
}

/** What a player did in a match: goals with their minute, assists and cards. */
export function PlayerEvents({
  goals,
  minutes,
  assists,
  yellowCards,
  redCards,
}: {
  goals: number;
  minutes: number[];
  assists: number;
  yellowCards: number;
  redCards: number;
}) {
  const cards = cardsFor(yellowCards, redCards);
  const off = sendingOff(yellowCards, redCards);
  if (goals === 0 && assists === 0 && cards.length === 0) return null;
  return (
    // Many goals wrap onto more lines, between goals, instead of squeezing what sits beside them.
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold">
      {goals > 0 && (
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {minutes.length ? (
            minutes.map((m, index) => (
              <span key={index} className="inline-flex items-center gap-1 whitespace-nowrap">
                <GoalIcon /> {m}′
              </span>
            ))
          ) : (
            <span role="img" aria-label={`${goals} ${goals === 1 ? "gol" : "goles"}`} className="inline-flex items-center gap-0.5">
              {Array.from({ length: goals }, (_, index) => (
                <GoalIcon key={index} />
              ))}
            </span>
          )}
        </span>
      )}
      {assists > 0 && (
        <span role="img" aria-label={`${assists} ${assists === 1 ? "asistencia" : "asistencias"}`} className="inline-flex items-center gap-0.5 text-muted">
          {Array.from({ length: assists }, (_, index) => (
            <AssistIcon key={index} />
          ))}
        </span>
      )}
      {cards.length > 0 && (
        <span className="inline-flex items-center gap-1">
          {cards.map((kind) => (
            <CardIcon key={kind} kind={kind} />
          ))}
          {off && <span className="font-medium text-muted">{off}</span>}
        </span>
      )}
    </span>
  );
}

/** Legend for the symbols above. */
export function PlayerEventsLegend({ extra }: { extra?: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span className="inline-flex items-center gap-1">
        <GoalIcon /> gol (con minuto)
      </span>
      <span className="inline-flex items-center gap-1">
        <AssistIcon /> asistencia
      </span>
      <span className="inline-flex items-center gap-1">
        <CardIcon kind="yellow" /> amarilla
      </span>
      <span className="inline-flex items-center gap-1">
        <CardIcon kind="second-yellow" /> doble amarilla
      </span>
      <span className="inline-flex items-center gap-1">
        <CardIcon kind="red" /> roja directa
      </span>
      {extra && <span>{extra}</span>}
    </p>
  );
}
