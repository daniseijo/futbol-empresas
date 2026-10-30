import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LeagueTree } from "@/lib/sportspress/leagues";
import { buildTeamContext } from "@/lib/views/team-context";
import { match, result } from "@/test/fixtures";

const tree = new LeagueTree([
  { id: 114, name: "Liga Apertura", slug: "2-liga-apertura", parentId: null },
  { id: 543, name: "Grupo 20", slug: "grupo-20", parentId: 114 },
  { id: 116, name: "La Champions de las Empresas", slug: "3-la-champions-de-las-empresas", parentId: null },
  { id: 335, name: "Sector Banca y Financiero", slug: "sector-banca", parentId: 116 },
  { id: 344, name: "Champions Fase Liga - Banca y Financiero", slug: "fase-liga-banca", parentId: 335 },
]);

describe("buildTeamContext", () => {
  // Embat plays the league on Thursday 29 October and the Champions on Wednesday 4 November.
  const league = { leagueIds: [114, 543], groupId: 543, competitionId: 114 };
  const champions = { leagueIds: [116, 335, 344], groupId: 344, competitionId: 116 };
  const matches = [
    result(1, 2, 1, 2, { ...league, round: 5, date: "2026-10-29T21:10" }),
    result(3, 0, 0, 4, { ...league, round: 5, date: "2026-10-29T22:00" }),
    match({ homeId: 5, awayId: 1, ...champions, round: 1, date: "2026-11-04T20:00" }),
  ];

  it("keeps the last result's group until the Monday of the next match's week", () => {
    const context = buildTeamContext(1, matches, tree, "2026-10-31T12:00");
    assert.equal(context.group?.name, "Grupo 20");
    assert.equal(context.row?.position, 1);
  });

  it("moves to the next match's group with its preview", () => {
    const context = buildTeamContext(1, matches, tree, "2026-11-02T09:00");
    assert.equal(context.group?.name, "Champions Fase Liga - Banca y Financiero");
    assert.equal(context.nextOpponent?.teamId, 5);
  });

  it("knows which of the team's matches are in the Champions", () => {
    const context = buildTeamContext(1, matches, tree, "2026-10-31T12:00");
    assert.deepEqual(Object.values(context.champions), [{ phase: "Fase liga", round: 1, sector: "Banca y Financiero" }]);
  });

  describe("a match the league has not scored yet", () => {
    // Embat played the Champions on Thursday 29 October; the league has not published the score.
    const played = result(1, 2, 1, 2, { ...league, round: 4, date: "2026-10-22T21:00" });
    const unscored = match({ homeId: 5, awayId: 1, ...champions, round: 1, date: "2026-10-29T20:00" });
    const later = (date: string) => match({ homeId: 1, awayId: 3, ...league, round: 5, date });

    it("stays the next match, so the summary keeps its preview", () => {
      const context = buildTeamContext(1, [played, unscored, later("2026-11-12T21:00")], tree, "2026-10-30T10:00");
      assert.equal(context.nextMatch?.id, unscored.id);
      assert.equal(context.group?.name, "Champions Fase Liga - Banca y Financiero");
    });

    it("gives way from the Monday of the next match's week", () => {
      const next = later("2026-11-05T21:00");
      assert.equal(buildTeamContext(1, [played, unscored, next], tree, "2026-11-01T10:00").nextMatch?.id, unscored.id);
      assert.equal(buildTeamContext(1, [played, unscored, next], tree, "2026-11-02T10:00").nextMatch?.id, next.id);
    });

    it("gives way after a week, or once a later match has a score", () => {
      assert.equal(buildTeamContext(1, [played, unscored], tree, "2026-11-05T10:00").nextMatch?.id, unscored.id);
      assert.equal(buildTeamContext(1, [played, unscored], tree, "2026-11-06T10:00").nextMatch, null);
      const scored = result(1, 1, 0, 3, { ...league, round: 5, date: "2026-11-03T21:00" });
      assert.equal(buildTeamContext(1, [played, unscored, scored], tree, "2026-11-04T10:00").nextMatch, null);
    });
  });
});
