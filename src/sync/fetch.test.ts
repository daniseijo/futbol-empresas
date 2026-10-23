import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RawEvent } from "@/lib/sportspress/raw";
import { mapEvent, type LeagueLookup } from "@/sync/fetch";

// A two-level tree: competition 10 > group 20.
const leagues: LeagueLookup = {
  deepest: (ids) => (ids.includes(20) ? 20 : (ids[0] ?? null)),
  root: () => 10,
};

function rawEvent(fields: Partial<RawEvent> = {}): RawEvent {
  return {
    id: 133799,
    date: "2026-10-22T21:00:38",
    status: "publish",
    title: { rendered: "J4 &#8211; Imageen Gamhur vs Embat" },
    leagues: [10, 20],
    seasons: [7],
    venues: [3],
    teams: [101, 102],
    main_results: ["2", "1"],
    ...fields,
  };
}

describe("mapEvent", () => {
  it("maps a played match", () => {
    const { match } = mapEvent(rawEvent(), leagues)!;
    assert.equal(match.date, "2026-10-22T21:00");
    assert.equal(match.round, 4);
    assert.deepEqual([match.homeName, match.awayName], ["Imageen Gamhur", "Embat"]);
    assert.deepEqual([match.homeGoals, match.awayGoals, match.played], [2, 1, true]);
    assert.deepEqual([match.groupId, match.competitionId, match.venueId, match.seasonId], [20, 10, 3, 7]);
  });

  it("counts a match with a score as played even if its status is future", () => {
    const { match } = mapEvent(rawEvent({ status: "future", main_results: ["0", "3"] }), leagues)!;
    assert.deepEqual([match.homeGoals, match.awayGoals, match.played], [0, 3, true]);
  });

  it("leaves a match without a score unplayed", () => {
    for (const main_results of [[], ["", ""], ["1"]]) {
      const { match } = mapEvent(rawEvent({ status: "future", main_results }), leagues)!;
      assert.deepEqual([match.homeGoals, match.awayGoals, match.played], [null, null, false]);
    }
  });

  it("skips events without exactly two teams", () => {
    assert.equal(mapEvent(rawEvent({ teams: [101] }), leagues), null);
  });

  it("reads the lineups, whatever shape the position comes in", () => {
    const { lineups } = mapEvent(
      rawEvent({
        performance: {
          "0": {},
          "101": {
            "501": { number: "7", position: ["97"], goals: "2 (42', 44')", asistencia: "1", yellowcards: "1", redcards: "0", crack: "1", puntuacion: "13,5" },
            "502": { position: "100" as unknown as string[] },
            "503": { position: { 0: "99" } as unknown as string[] },
            "0": { goals: "9" },
          },
          "102": [],
        },
      }),
      leagues,
    )!;
    const byPlayer = Object.fromEntries(lineups.map((p) => [p.playerId, p]));
    assert.deepEqual(Object.keys(byPlayer), ["501", "502", "503"]);
    assert.deepEqual(
      [byPlayer[501].position, byPlayer[502].position, byPlayer[503].position],
      ["DEL", "POR", "DEF"],
    );
    const scorer = byPlayer[501];
    assert.deepEqual(
      [scorer.teamId, scorer.number, scorer.goals, scorer.minutes, scorer.assists, scorer.yellowCards, scorer.crack, scorer.points],
      [101, "7", 2, [42, 44], 1, 1, true, 13.5],
    );
  });

  it("keeps a player who appears in both lineups", () => {
    const { lineups } = mapEvent(rawEvent({ performance: { "101": { "501": { number: "1" } }, "102": { "501": { number: "1" } } } }), leagues)!;
    assert.deepEqual(
      lineups.map((p) => [p.playerId, p.teamId]),
      [
        [501, 101],
        [501, 102],
      ],
    );
  });
});
