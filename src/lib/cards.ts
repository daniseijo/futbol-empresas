export type CardKind = "yellow" | "red" | "second-yellow";

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
