import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { championsStage, championsStageLabel, isChampions } from "@/lib/sportspress/champions";
import { LeagueTree } from "@/lib/sportspress/leagues";

// The real ids of 26/27, to show that none of them is what the code relies on.
const tree = new LeagueTree([
  { id: 114, name: "Liga Apertura", slug: "2-liga-apertura", parentId: null },
  { id: 120, name: "Grupo 20", slug: "grupo-20", parentId: 114 },
  { id: 116, name: "La Champions de las Empresas", slug: "3-la-champions-de-las-empresas", parentId: null },
  { id: 335, name: "Sector Banca y Financiero", slug: "sector-banca", parentId: 116 },
  { id: 344, name: "Champions Fase Liga - Banca y Financiero", slug: "fase-liga-banca", parentId: 335 },
]);

describe("isChampions", () => {
  it("recognises the Champions by its root's name", () => {
    assert.equal(isChampions({ competitionId: 116 }, tree), true);
    assert.equal(isChampions({ competitionId: 114 }, tree), false);
    assert.equal(isChampions({ competitionId: null }, tree), false);
    assert.equal(isChampions({ competitionId: 999 }, tree), false);
  });
});

describe("championsStage", () => {
  it("is null outside the Champions", () => {
    assert.equal(championsStage({ competitionId: 114, groupId: 120, round: 3 }, tree), null);
  });

  it("places a fase liga match in its round and sector", () => {
    const stage = championsStage({ competitionId: 116, groupId: 344, round: 1 }, tree)!;
    assert.deepEqual(stage, { phase: "Fase liga", round: 1, sector: "Banca y Financiero" });
    assert.equal(championsStageLabel(stage), "Fase liga · Jornada 1");
    assert.equal(championsStageLabel(stage, true), "Fase liga · J1");
  });

  it("keeps a fase liga match the API left without a round in the fase liga", () => {
    assert.deepEqual(championsStage({ competitionId: 116, groupId: 344, round: null }, tree), {
      phase: "Fase liga",
      round: null,
      sector: "Banca y Financiero",
    });
  });

  it("takes a knockout match's phase from its bracket round", () => {
    const knockout = (label?: string) => championsStage({ competitionId: 116, groupId: 335, round: null }, tree, label)?.phase;
    assert.equal(knockout("F"), "Final");
    assert.equal(knockout("1/2"), "Semis");
    assert.equal(knockout("1/4"), "Cuartos");
    assert.equal(knockout("1/8"), "Eliminatoria");
    assert.equal(knockout(), "Eliminatoria");
    assert.equal(championsStageLabel(championsStage({ competitionId: 116, groupId: 335, round: null }, tree, "1/4")!), "Cuartos");
  });
});
