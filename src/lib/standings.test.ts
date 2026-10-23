import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeStandings } from "@/lib/standings";
import { match, result } from "@/test/fixtures";

const byTeam = (rows: ReturnType<typeof computeStandings>) => Object.fromEntries(rows.map((r) => [r.teamId, r]));

describe("computeStandings", () => {
  it("gives 3 points for a win, 1 for a draw and 0 for a loss", () => {
    const rows = byTeam(computeStandings([result(1, 3, 1, 2), result(1, 2, 2, 3)]));
    assert.equal(rows[1].points, 4);
    assert.deepEqual([rows[1].won, rows[1].drawn, rows[1].lost], [1, 1, 0]);
    assert.equal(rows[2].points, 0);
    assert.equal(rows[3].points, 1);
    assert.deepEqual([rows[1].goalsFor, rows[1].goalsAgainst], [5, 3]);
  });

  it("breaks ties by goal difference, then goals scored, then name", () => {
    // Everyone but 9 wins once (3 points).
    const rows = computeStandings([
      result(1, 5, 0, 9), // goal difference +5
      result(4, 3, 2, 9), // +1 with 3 goals scored
      result(2, 1, 0, 9, { homeName: "Deloitte" }), // +1 with 1 goal: by name
      result(3, 1, 0, 9, { homeName: "Cardif" }),
      result(5, 1, 0, 9, { homeName: "BBVA" }),
      result(6, 1, 0, 9, { homeName: "Acciona" }),
    ]);
    assert.deepEqual(
      rows.map((r) => r.teamId),
      [1, 4, 6, 5, 3, 2, 9],
    );
    assert.deepEqual(
      rows.map((r) => r.position),
      [1, 2, 3, 4, 5, 6, 7],
    );
  });

  it("lists teams with unplayed matches but does not count them", () => {
    const rows = byTeam(computeStandings([result(1, 2, 0, 2), match({ homeId: 3, awayId: 1 })]));
    assert.equal(rows[1].played, 1);
    assert.equal(rows[3].played, 0);
    assert.equal(rows[3].points, 0);
  });

  it("keeps the last five results, oldest first, whatever the input order", () => {
    const dates = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"];
    const scores: [number, number][] = [[0, 1], [1, 0], [1, 1], [2, 0], [0, 3], [4, 4]];
    const matches = dates.map((date, i) => result(1, scores[i][0], scores[i][1], 2, { date: `${date}T21:00` })).reverse();
    assert.deepEqual(byTeam(computeStandings(matches))[1].form, ["V", "E", "V", "D", "E"]);
  });
});
