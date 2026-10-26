import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { idealSeven, sheetScore, type SheetTotals } from "@/lib/ideal-seven";

function totals(fields: Partial<SheetTotals> & Pick<SheetTotals, "playerId" | "position">): SheetTotals {
  return { teamId: 1, matches: 4, points: 0, goals: 0, assists: 0, cracks: 0, dandies: 0, cleanSheets: 0, ...fields };
}

/** Liga Apertura 26/27 after four rounds, as futbolempresas.es showed its 7 ideal on 26 Oct 2026. */
const apertura: SheetTotals[] = [
  totals({ playerId: 1, position: "DEL", points: 19, goals: 9, assists: 4, cracks: 1, dandies: 1 }), // Rubén Fernández 33,0
  totals({ playerId: 2, position: "DEL", matches: 3, points: 14, goals: 10, assists: 3, cracks: 2 }), // Telmo Lertxundi 29,5
  totals({ playerId: 3, position: "MED", points: 19, goals: 9, assists: 3, cracks: 2, dandies: 1 }), // Mario Nodal 34,5
  totals({ playerId: 4, position: "MED", points: 18, goals: 8, assists: 3, cracks: 2 }), // Daniel Arribas 31,5
  totals({ playerId: 5, position: "DEF", points: 16, goals: 6, assists: 1, cracks: 2, cleanSheets: 1 }), // Ethan Prosser 26,5
  totals({ playerId: 6, position: "DEF", points: 16, goals: 6, cracks: 1 }), // Jhon Jairo Valencia 24,0
  totals({ playerId: 7, position: "DEF", points: 17, goals: 5, assists: 2, dandies: 1 }), // Antonio Hernández 24,0
  totals({ playerId: 8, position: "POR", points: 16, cracks: 1, dandies: 1, cleanSheets: 2 }), // Pedro José Méndez 23,0
  totals({ playerId: 9, position: "DEL", points: 15, goals: 9, assists: 2, cracks: 1 }), // 27,0
];

describe("sheetScore", () => {
  it("matches the league's scores", () => {
    assert.deepEqual(apertura.map(sheetScore), [33, 29.5, 34.5, 31.5, 26.5, 24, 24, 23, 27]);
  });

  it("gives clean sheets to goalkeepers only", () => {
    assert.equal(sheetScore(totals({ playerId: 1, position: "POR", cleanSheets: 2 })), 4);
    assert.equal(sheetScore(totals({ playerId: 1, position: "DEF", cleanSheets: 2 })), 0);
  });
});

describe("idealSeven", () => {
  it("picks the league's 7 ideal", () => {
    const seven = idealSeven(apertura);
    assert.deepEqual(
      Object.fromEntries(Object.entries(seven).map(([position, players]) => [position, players.map((p) => [p.playerId, p.score])])),
      {
        DEL: [
          [1, 33],
          [2, 29.5],
        ],
        MED: [
          [3, 34.5],
          [4, 31.5],
        ],
        DEF: [
          [5, 26.5],
          [6, 24],
        ],
        POR: [[8, 23]],
      },
    );
  });

  it("breaks a tie with MVPs, as the league did", () => {
    assert.deepEqual(
      idealSeven(apertura).DEF.map((p) => p.playerId),
      [5, 6],
    );
  });

  it("adds up a player's lines and teams, and puts them in the line and team they played most", () => {
    const seven = idealSeven([
      totals({ playerId: 1, teamId: 10, position: "MED", matches: 3, points: 12 }),
      totals({ playerId: 1, teamId: 10, position: "DEL", matches: 1, points: 4 }),
      totals({ playerId: 1, teamId: 20, position: "MED", matches: 1, points: 5 }),
    ]);
    assert.deepEqual(seven.MED, [{ playerId: 1, teamId: 10, position: "MED", score: 21, matches: 5 }]);
    assert.deepEqual(seven.DEL, []);
  });

  it("leaves out players without a line, and a line short when nobody plays there", () => {
    const seven = idealSeven([totals({ playerId: 1, position: null, points: 40 }), totals({ playerId: 2, position: "DEL", points: 5 })]);
    assert.deepEqual(
      seven.DEL.map((p) => p.playerId),
      [2],
    );
    assert.deepEqual(seven.POR, []);
  });
});
