import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fillMissingRounds } from "@/lib/rounds";
import { match } from "@/test/fixtures";

describe("fillMissingRounds", () => {
  // The Champions' J1 of 26/27 in Banca y Financiero: six matches with their round, Singular Bank (13) –
  // Openbank (10) on Wednesday 4 November without it.
  const faseLiga = { groupId: 344 };
  const j1 = [
    match({ homeId: 7, awayId: 3, round: 1, date: "2026-11-03T20:30", ...faseLiga }),
    match({ homeId: 9, awayId: 14, round: 1, date: "2026-11-03T21:10", ...faseLiga }),
    match({ homeId: 12, awayId: 6, round: 1, date: "2026-11-04T20:00", ...faseLiga }),
    match({ homeId: 5, awayId: 2, round: 1, date: "2026-11-04T21:00", ...faseLiga }),
    match({ homeId: 4, awayId: 1, round: 1, date: "2026-11-05T20:15", ...faseLiga }),
    match({ homeId: 11, awayId: 8, round: 1, date: "2026-11-05T21:10", ...faseLiga }),
  ];
  const singularOpenbank = match({ homeId: 13, awayId: 10, round: null, date: "2026-11-04T21:15", ...faseLiga });

  it("puts a match without a round in the round its dates fall in", () => {
    const filled = fillMissingRounds([...j1, singularOpenbank]);
    assert.equal(filled.find((m) => m.id === singularOpenbank.id)?.round, 1);
    assert.equal(singularOpenbank.round, null, "the original is not changed");
  });

  it("skips a round in which one of its teams already plays", () => {
    const j2 = match({ homeId: 1, awayId: 2, round: 2, date: "2026-11-12T20:00", ...faseLiga });
    const rematch = match({ homeId: 7, awayId: 13, round: null, date: "2026-11-05T22:00", ...faseLiga });
    assert.equal(fillMissingRounds([...j1, j2, rematch]).find((m) => m.id === rematch.id)?.round, 2);
  });

  it("leaves a match no round fits without one", () => {
    const later = match({ homeId: 13, awayId: 10, round: null, date: "2026-12-20T20:00", ...faseLiga });
    assert.equal(fillMissingRounds([...j1, later]).find((m) => m.id === later.id)?.round, null);
  });

  it("leaves knockout groups alone", () => {
    const knockout = [
      match({ homeId: 1, awayId: 2, date: "2026-05-04T20:00", groupId: 335 }),
      match({ homeId: 3, awayId: 4, date: "2026-05-05T20:00", groupId: 335 }),
    ];
    assert.deepEqual(fillMissingRounds(knockout), knockout);
  });

  it("does not mix groups", () => {
    const otherGroup = match({ homeId: 13, awayId: 10, round: null, date: "2026-11-04T21:15", groupId: 543 });
    assert.equal(fillMissingRounds([...j1, otherGroup]).find((m) => m.id === otherGroup.id)?.round, null);
  });
});
