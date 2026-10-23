import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cardsFor, sendingOff } from "@/lib/cards";

// The API only gives counts per match: these are the combinations seen in production.
describe("cardsFor / sendingOff", () => {
  const cases: [yellow: number, red: number, cards: string[], off: string | null][] = [
    [0, 0, [], null],
    [1, 0, ["yellow"], null],
    [0, 1, ["red"], "roja"],
    [1, 1, ["yellow", "red"], "roja"], // booked, then a straight red
    [2, 1, ["second-yellow"], "doble amarilla"],
    [2, 0, ["second-yellow"], "doble amarilla"], // a few old sheets carry no red
  ];
  for (const [yellow, red, cards, off] of cases) {
    it(`${yellow} yellow and ${red} red`, () => {
      assert.deepEqual(cardsFor(yellow, red), cards);
      assert.equal(sendingOff(yellow, red), off);
    });
  }
});
