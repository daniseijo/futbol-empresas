export type CardKind = "yellow" | "red" | "second-yellow";

const CARD_LABEL: Record<CardKind, string> = {
  yellow: "Amarilla",
  red: "Roja directa",
  "second-yellow": "Doble amarilla",
};

/**
 * The cards a player got in a match. The API only counts them: a second yellow
 * arrives as 2 yellows and 1 red (a few old sheets, 2 yellows and no red), and
 * 1 yellow plus 1 red is a booking followed by a straight red.
 */
export function cardsFor(yellowCards: number, redCards: number): CardKind[] {
  if (yellowCards >= 2) return ["second-yellow"];
  const cards: CardKind[] = [];
  if (yellowCards === 1) cards.push("yellow");
  if (redCards > 0) cards.push("red");
  return cards;
}

/** Whether the player was sent off, and how ("roja" or "doble amarilla"). */
export function sendingOff(yellowCards: number, redCards: number): string | null {
  const cards = cardsFor(yellowCards, redCards);
  if (cards.includes("second-yellow")) return "doble amarilla";
  return cards.includes("red") ? "roja" : null;
}

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
    <span className="inline-flex items-center gap-2 text-xs font-semibold whitespace-nowrap">
      {goals > 0 && <span>{minutes.length ? minutes.map((m) => `● ${m}′`).join(" ") : "●".repeat(goals)}</span>}
      {assists > 0 && <span className="text-muted">{"◆".repeat(assists)}</span>}
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
      <span>◆ asistencia</span>
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
