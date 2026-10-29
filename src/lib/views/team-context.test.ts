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
});
