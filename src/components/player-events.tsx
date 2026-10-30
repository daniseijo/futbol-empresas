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

// The ball is MingCute's "football-fill" and the boot Material Symbols' "shoe-cleats" (both Apache 2.0). Their view
// boxes are cropped to the drawing so they fill the text height. Both are muted, so the minutes stand out.

/** A goal, as a football. */
export function GoalIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="2 2 20 20" aria-hidden className={`inline-block h-3 w-3 shrink-0 fill-current text-muted ${className}`}>
      <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2m.588 4.809a1 1 0 0 1-1.04.084l-.136-.084l-2.82-2.048A8 8 0 0 0 6.17 6.524l1.075 3.312c.117.36.02.752-.241 1.015l-.122.103l-2.818 2.048a8 8 0 0 0 .925 2.851l3.485.002a1 1 0 0 1 .89.541l.06.149l1.078 3.312q.73.141 1.499.143q.769-.002 1.499-.143l1.076-3.311c.117-.36.427-.62.792-.679l.16-.013h3.484A7.9 7.9 0 0 0 19.936 13l-2.817-2.046a1 1 0 0 1-.401-.962l.038-.156l1.074-3.313a8 8 0 0 0-2.424-1.763zM11.412 8.19a1 1 0 0 1 1.176 0l2.853 2.073a1 1 0 0 1 .364 1.118l-1.09 3.354a1 1 0 0 1-.951.69h-3.528a1 1 0 0 1-.95-.69l-1.09-3.354a1 1 0 0 1 .363-1.118z" />
    </svg>
  );
}

/** An assist, as a football boot. */
export function AssistIcon() {
  return (
    <svg viewBox="2.2 1 18.9 21" aria-hidden className="inline-block h-[13px] w-3 shrink-0 fill-current">
      <path d="M5.55 22.025q-.8 0-1.537-.3t-1.313-.9l-.175-.175q-.225-.2-.287-.5t.062-.575l1.55-3.95l2.325.8q.3.1.575-.037t.375-.438q.125-.275-.012-.55T6.7 15l-2.3-.775l.425-1.1l2.425.825q.3.1.575-.038t.375-.437q.1-.275-.025-.55t-.4-.375l-2.4-.825l.425-1.1l2.5.85q.3.125.575-.012t.375-.438q.125-.3-.013-.562t-.412-.388L6.35 9.25l.8-2.05q.2-.5.688-.762T8.85 6.3l1.45.275q.425.075.8-.062t.675-.438q.325-.35.45-.775t0-.85l-.125-.375q-.125-.4-.037-.812t.387-.713l1.075-1.075q.425-.45 1.063-.45t1.062.425l4.525 4.6q.55.575.563 1.363t-.513 1.362l.475.475q.15.175.263.363t.112.387q0 .175-.075.35t-.275.375q-.3.275-.712.288t-.713-.288l-.45-.475l-.7.725l.45.45q.275.275.275.7t-.275.7q-.3.275-.712.288t-.713-.288l-.45-.425l-2.8 2.85l.425.4q.3.3.3.713t-.3.712q-.3.275-.712.288t-.713-.288l-.4-.425l-.7.725l.4.4q.275.275.275.7t-.275.7q-.3.275-.712.287t-.713-.287l-.4-.375l-.7.7l.4.375q.275.3.275.713t-.275.712q-.3.275-.712.288t-.713-.288l-.4-.4q-.575.575-1.263.85t-1.462.275" />
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
