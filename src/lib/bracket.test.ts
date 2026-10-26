import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildKnockout, knockoutLabels, type Bracket } from "@/lib/bracket";
import type { Match } from "@/lib/sportspress/types";
import { match } from "@/test/fixtures";

type Row = [id: number, date: string, homeId: number, awayId: number, homeGoals: number | null, awayGoals: number | null];

const toMatches = (rows: Row[]): Match[] =>
  rows.map(([id, date, homeId, awayId, homeGoals, awayGoals]) => match({ id, date, homeId, awayId, homeGoals, awayGoals }));

const NOW = "2026-10-26T12:00";
const GRUPO_COBRA = 8567;
const ONCE_A = 39363;
const NOBE = 130870;
const SECURITAS = 63239;

/** Corporate Cup 26/27: three 16-team brackets under one node, one tie entered twice (131645). */
const corporateCup2026: Row[] = [
  [131049, "2026-09-07T22:05", 114813, 83454, 3, 6],
  [131050, "2026-09-07T22:05", 4314, 104440, 6, 6],
  [131051, "2026-09-08T21:10", 6133, 39359, 6, 5],
  [131052, "2026-09-08T21:10", 17832, 6075, 2, 3],
  [131053, "2026-09-07T22:05", 7374, 69416, 6, 10],
  [131054, "2026-09-09T21:10", 78495, 97175, 8, 1],
  [131055, "2026-09-10T20:15", 7914, 56692, 2, 2],
  [131056, "2026-09-10T21:10", 8567, 116227, 5, 2],
  [131057, "2026-09-07T20:15", 70345, 98216, 3, 4],
  [131058, "2026-09-07T21:10", 115822, 17926, 3, 7],
  [131059, "2026-09-08T20:30", 89899, 17985, 4, 3],
  [131060, "2026-09-10T20:15", 94716, 8579, 5, 3],
  [131061, "2026-09-09T22:05", 97247, 97214, 6, 5],
  [131062, "2026-09-10T20:15", 39363, 112217, 3, 1],
  [131063, "2026-09-10T22:05", 6278, 4294, 1, 6],
  [131064, "2026-09-10T21:10", 7508, 41101, 5, 9],
  [131065, "2026-09-07T20:15", 7667, 113787, 1, 4],
  [131066, "2026-09-07T21:10", 94719, 70956, 4, 3],
  [131067, "2026-09-07T21:10", 106250, 8126, 4, 1],
  [131068, "2026-09-07T21:10", 18435, 130818, 0, 1],
  [131069, "2026-09-09T20:15", 6644, 130870, 2, 9],
  [131070, "2026-09-10T22:05", 123088, 130938, 5, 2],
  [131071, "2026-09-08T20:15", 99095, 70050, 2, 14],
  [131072, "2026-09-10T21:10", 121497, 112239, 5, 2],
  [131228, "2026-09-14T21:10", 83454, 4314, 6, 6],
  [131229, "2026-09-15T21:30", 6133, 6075, 0, 3],
  [131232, "2026-09-14T20:15", 98216, 17926, 7, 4],
  [131237, "2026-09-14T21:10", 113787, 94719, 2, 3],
  [131238, "2026-09-14T20:15", 106250, 130818, 6, 1],
  [131329, "2026-09-16T21:10", 69416, 78495, 3, 3],
  [131330, "2026-09-17T20:15", 56692, 8567, 0, 3],
  [131331, "2026-09-15T20:30", 89899, 94716, 4, 5],
  [131332, "2026-09-16T21:10", 97247, 39363, 1, 3],
  [131333, "2026-09-17T21:10", 4294, 41101, 2, 0],
  [131334, "2026-09-16T20:15", 130870, 123088, 11, 4],
  [131335, "2026-09-15T20:15", 70050, 121497, 2, 4],
  [131555, "2026-09-21T20:15", 94719, 106250, 3, 4],
  [131556, "2026-09-21T20:15", 130870, 121497, 5, 3],
  [131558, "2026-09-21T21:10", 98216, 94716, 1, 3],
  [131561, "2026-09-21T22:05", 4314, 6075, 5, 3],
  [131645, "2026-09-17T20:15", 56692, 8567, 0, 3],
  [131740, "2026-09-21T21:10", 39363, 4294, 3, 2],
  [131741, "2026-09-21T22:05", 69416, 8567, 1, 5],
  [131805, "2026-09-23T21:10", 4314, 8567, 2, 5],
  [131806, "2026-09-23T20:15", 106250, 130870, 1, 3],
  [131807, "2026-09-23T20:15", 94716, 39363, 1, 3],
];

/** Corporate Cup 23/24, Primera: a final drawn 1-1 (Securitas Direct – Grupo Cobra). */
const corporatePrimera2023: Row[] = [
  [84058, "2023-09-07T22:05", 63239, 50099, 10, 4],
  [84059, "2023-09-05T21:30", 6075, 6133, 1, 3],
  [84060, "2023-09-04T22:05", 40988, 6416, 8, 5],
  [84061, "2023-09-04T22:05", 17926, 27063, 0, 5],
  [84062, "2023-09-07T20:15", 69342, 8567, 6, 9],
  [84063, "2023-09-05T20:30", 17832, 8010, 1, 5],
  [84064, "2023-09-06T21:10", 4044, 71356, 5, 1],
  [84065, "2023-09-04T21:10", 29616, 67936, 3, 5],
  [84317, "2023-09-14T21:10", 63239, 6133, 7, 0],
  [84318, "2023-09-11T22:05", 40988, 27063, 5, 5],
  [84319, "2023-09-14T20:15", 8567, 8010, 9, 4],
  [84320, "2023-09-13T21:10", 4044, 67936, 3, 8],
  [84429, "2023-09-18T21:10", 63239, 27063, 6, 2],
  [84430, "2023-09-21T21:10", 8567, 67936, 3, 0],
  [84978, "2023-09-25T22:05", 63239, 8567, 1, 1],
];

/** Copa 22/23, Primera Plata: the final's away team was never filled in (-1). */
const copaPlata2023: Row[] = [
  [83126, "2023-06-15T20:15", 40988, 74291, 3, 0],
  [83127, "2023-06-14T21:30", 34760, 6400, 5, 2],
  [83128, "2023-06-14T21:10", 77322, 74276, 4, 2],
  [83129, "2023-06-14T21:10", 8379, 69342, 9, 2],
  [83130, "2023-06-13T21:00", 68099, 6133, 1, 0],
  [83131, "2023-06-15T22:05", 32894, 8219, 4, 8],
  [83132, "2023-06-12T21:10", 4294, 69416, 3, 0],
  [83133, "2023-06-15T22:05", 7914, 39359, 10, 4],
  [83270, "2023-06-19T22:00", 40988, 34760, 5, 3],
  [83271, "2023-06-20T21:00", 77322, 8379, 4, 3],
  [83272, "2023-06-19T22:00", 68099, 8219, 7, 3],
  [83273, "2023-06-20T21:00", 4294, 7914, 0, 4],
  [83363, "2023-06-22T21:00", 40988, 77322, 8, 5],
  [83364, "2023-06-22T21:00", 68099, 7914, 2, 1],
  [83406, "2023-06-26T21:00", 40988, -1, null, null],
];

const teamsOf = (bracket: Bracket, round: number) => bracket.rounds[round].ties.flatMap((t) => [t.match.homeId, t.match.awayId]);

describe("buildKnockout", () => {
  it("splits several brackets in one node and names their rounds", () => {
    const { brackets, others } = buildKnockout(toMatches(corporateCup2026), {
      now: NOW,
    });
    assert.equal(brackets.length, 3);
    assert.deepEqual(others, []);
    for (const bracket of brackets) {
      assert.deepEqual(
        bracket.rounds.map((r) => [r.name, r.ties.length]),
        [
          ["Octavos", 8],
          ["Cuartos", 4],
          ["Semifinales", 2],
          ["Final", 1],
        ],
      );
    }
    assert.deepEqual(
      brackets.map((b) => b.championId),
      [GRUPO_COBRA, ONCE_A, NOBE],
    );
  });

  it("drops a tie entered twice", () => {
    const { brackets } = buildKnockout(toMatches(corporateCup2026), {
      now: NOW,
    });
    const ids = brackets.flatMap((b) => b.rounds.flatMap((r) => r.ties.map((t) => t.match.id)));
    assert.ok(ids.includes(131330));
    assert.ok(!ids.includes(131645));
  });

  it("orders each round so that ties 2k and 2k+1 feed tie k", () => {
    for (const bracket of buildKnockout(toMatches(corporateCup2026), {
      now: NOW,
    }).brackets) {
      for (let r = 0; r < bracket.rounds.length - 1; r += 1) {
        bracket.rounds[r + 1].ties.forEach((next, k) => {
          const feeders = bracket.rounds[r].ties.slice(2 * k, 2 * k + 2).map((t) => t.winnerId);
          assert.deepEqual(feeders, [next.match.homeId, next.match.awayId]);
        });
      }
      // Every team is in the first round once.
      assert.equal(new Set(teamsOf(bracket, 0)).size, 16);
    }
  });

  it("sends a drawn tie's winner through to the next round", () => {
    const { brackets } = buildKnockout(toMatches(corporateCup2026), {
      now: NOW,
    });
    // Sanitas 6-6 Ecija in the first round; Sanitas played the next one.
    const tie = brackets.flatMap((b) => b.rounds[0].ties).find((t) => t.match.id === 131050)!;
    assert.equal(tie.winnerId, 4314);
  });

  it("leaves a drawn final without a winner unless the league recorded one", () => {
    const [bracket] = buildKnockout(toMatches(corporatePrimera2023), {
      now: NOW,
    }).brackets;
    assert.deepEqual(teamsOf(bracket, 3), [SECURITAS, GRUPO_COBRA]);
    assert.equal(bracket.championId, null);
    assert.equal(bracket.rounds[3].ties[0].winnerId, null);
    const [settled] = buildKnockout(toMatches(corporatePrimera2023), {
      now: NOW,
      champions: [GRUPO_COBRA],
    }).brackets;
    assert.equal(settled.championId, GRUPO_COBRA);
    assert.equal(knockoutLabels({ brackets: [settled], others: [] }).get(84978), "F");
  });

  it("falls back when the matches do not form a clean bracket", () => {
    // Without its final, the Dell half looks like an 8-team bracket: it must not show as one.
    const { brackets, others } = buildKnockout(toMatches(copaPlata2023), {
      now: NOW,
    });
    assert.deepEqual(brackets, []);
    assert.equal(others.length, copaPlata2023.length);
  });

  it("rejects a score that contradicts who went through", () => {
    const rows = corporatePrimera2023.map((row): Row => (row[0] === 84429 ? [84429, row[1], row[2], row[3], 2, 6] : row));
    assert.deepEqual(buildKnockout(toMatches(rows), { now: NOW }).brackets, []);
  });

  it("waits for a recent final unless its champion is recorded", () => {
    const recent = { now: "2026-09-25T12:00" };
    assert.equal(buildKnockout(toMatches(corporateCup2026), recent).brackets.length, 0);
    const recorded = buildKnockout(toMatches(corporateCup2026), {
      ...recent,
      champions: [GRUPO_COBRA, ONCE_A, NOBE],
    });
    assert.equal(recorded.brackets.length, 3);
  });

  it("does not take placement matches or single finals for a bracket", () => {
    const finals = toMatches([
      [1, "2025-06-05T20:00", 1, 2, 3, 1],
      [2, "2025-06-05T21:00", 3, 4, 0, 2],
    ]);
    const { brackets, others } = buildKnockout(finals, { now: NOW });
    assert.deepEqual(brackets, []);
    assert.equal(others.length, 2);
  });
});
