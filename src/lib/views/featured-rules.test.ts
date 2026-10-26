import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { featuredMode, gap, positionBefore, trend } from "@/lib/views/featured-rules";
import { match, result, standingRow } from "@/test/fixtures";

describe("featuredMode", () => {
  // Friday 23 October 2026; the next week starts on Monday 26.
  const now = "2026-10-23T10:00";
  const yesterday = result(1, 2, 1, 2, { date: "2026-10-22T21:00" });
  const inDays = (days: number) => match({ homeId: 1, awayId: 3, date: `2026-10-${23 + days}T21:00` });

  it("is the result while the next match is in a later week", () => {
    const next = inDays(6);
    assert.deepEqual(featuredMode({ lastResults: [yesterday], nextMatch: next }, now), { mode: "result", matchId: yesterday.id, daysToNext: 6 });
    // Monday 26 is only 3 days away, but in the next week.
    assert.equal(featuredMode({ lastResults: [yesterday], nextMatch: inDays(3) }, now).mode, "result");
  });

  it("is the preview from the Monday of the match's week", () => {
    const thursday = match({ homeId: 1, awayId: 3, date: "2026-10-29T21:00" });
    assert.equal(featuredMode({ lastResults: [yesterday], nextMatch: thursday }, "2026-10-25T23:59").mode, "result");
    assert.deepEqual(featuredMode({ lastResults: [yesterday], nextMatch: thursday }, "2026-10-26T00:00"), {
      mode: "preview",
      matchId: thursday.id,
      daysToNext: 3,
    });
  });

  it("is the preview on match day before it is played", () => {
    const today = inDays(0);
    assert.deepEqual(featuredMode({ lastResults: [yesterday], nextMatch: today }, now), { mode: "preview", matchId: today.id, daysToNext: 0 });
  });

  it("stays on the result at the end of the season", () => {
    assert.deepEqual(featuredMode({ lastResults: [yesterday], nextMatch: null }, now), { mode: "result", matchId: yesterday.id, daysToNext: null });
  });

  it("is the preview at the start of the season, however far the first match is", () => {
    const first = inDays(8);
    assert.deepEqual(featuredMode({ lastResults: [], nextMatch: first }, now), { mode: "preview", matchId: first.id, daysToNext: 8 });
  });

  it("has no match when the team has none", () => {
    assert.equal(featuredMode({ lastResults: [], nextMatch: null }, now).matchId, null);
  });
});

describe("positionBefore", () => {
  const group = 50;
  const inGroup = { leagueIds: [7, group] };
  // Round 1: 1 beats 2. Round 2: 2 beats 3 by a lot and 1 loses to 3.
  const matches = [
    result(1, 1, 0, 2, { round: 1, ...inGroup }),
    result(2, 5, 0, 3, { round: 2, ...inGroup }),
    result(3, 1, 0, 1, { round: 2, ...inGroup }),
    result(1, 9, 0, 2, { round: 1, leagueIds: [99] }), // another group: ignored
  ];

  it("leaves the round out", () => {
    assert.equal(positionBefore(matches, group, 1, 2), 1);
    assert.equal(positionBefore(matches, group, 2, 2), 2);
  });

  it("is null for a team that had not played in the group", () => {
    assert.equal(positionBefore(matches, group, 42, 2), null);
  });
});

describe("trend", () => {
  it("says whether the team moved", () => {
    assert.equal(trend(7, 9), "Sube a 7º");
    assert.equal(trend(9, 7), "Baja a 9º");
    assert.equal(trend(9, 9), "Sigue 9º");
    assert.equal(trend(9, null), "9º");
  });
});

describe("gap", () => {
  const table = (...points: number[]) => points.map((p, i) => standingRow({ position: i + 1, points: p, name: ["Jakala", "Imageen", "Kearney", "Embat"][i] }));

  it("gives the leader's lead over the second", () => {
    const rows = table(9, 7, 1);
    assert.equal(gap(rows, rows[0]), "2 puntos por delante de Imageen");
  });

  it("says when the leader is level with the second", () => {
    const rows = table(7, 7);
    assert.equal(gap(rows, rows[0]), "Empatado a puntos con Imageen");
  });

  it("gives the distance to the team above, singular and plural", () => {
    const rows = table(9, 7, 1, 0);
    assert.equal(gap(rows, rows[3]), "A 1 punto de Kearney");
    assert.equal(gap(rows, rows[2]), "A 6 puntos de Imageen");
  });

  it("says when the team is level with the one above", () => {
    const rows = table(9, 3, 3);
    assert.equal(gap(rows, rows[2]), "Empatado a puntos con Imageen");
  });

  it("has nothing to say for a lone leader", () => {
    const rows = table(3);
    assert.equal(gap(rows, rows[0]), null);
  });
});
