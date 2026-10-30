import { Fragment } from "react";
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

/** An assist, as a football boot. */
export function AssistIcon() {
  return (
    <svg viewBox="0 0 16 12" aria-hidden className="inline-block h-3 w-4 shrink-0 fill-current">
      <path d="M2.3 1h3.9l.6 2.9c2.9.3 5.6 1.4 7.3 3 .8.8.6 2.3-.6 2.3H2.1c-.7 0-1.1-.5-1.1-1.2L1.5 4z" />
      <rect x="2.4" y="9.6" width="1.7" height="1.6" rx=".5" />
      <rect x="6.6" y="9.6" width="1.7" height="1.6" rx=".5" />
      <rect x="11.2" y="9.6" width="1.7" height="1.6" rx=".5" />
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
        <span>
          {minutes.length
            ? minutes.map((m, index) => (
                <Fragment key={index}>
                  {index > 0 && " "}
                  <span className="whitespace-nowrap">● {m}′</span>
                </Fragment>
              ))
            : "●".repeat(goals)}
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
      <span>● gol (con minuto)</span>
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
