import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeIndex, normalize, search, shortenUrl, type SearchIndexPayload } from "@/lib/search";

const base = "https://www.futbolempresas.es/wp-content/uploads/";

const payload: SearchIndexPayload = {
  base,
  teams: [
    ["embat", "Embat", "2024/09/embat.png", 1],
    ["grupo-telefonica", "Grupo Telefónica", null, 0],
    ["mutua-madrilena", "Mutua Madrileña", "https://example.com/mutua.png", 1],
    ["telefonica-femenino", "Telefónica Femenino", null, 1],
  ],
  players: [
    [1, "Íñigo Pérez", null, 0],
    [2, "Rubén García", "2016/08/ruben.jpg", 1],
    [3, "Rubén Sánchez", null, 2],
    [4, "Telmo Lertxundi", null, 2],
    [5, "Ana Rubio", null, -1],
  ],
};

const index = decodeIndex(payload);

describe("normalize", () => {
  it("drops case, accents and punctuation", () => {
    assert.equal(normalize("  Íñigo  Pérez-Ruiz "), "inigo perez ruiz");
    assert.equal(normalize("Kuehne + Nagel"), "kuehne nagel");
  });
});

describe("decodeIndex", () => {
  it("restores shortened URLs and links players to their team", () => {
    assert.equal(index.teams[0].item.logoUrl, `${base}2024/09/embat.png`);
    assert.equal(index.teams[2].item.logoUrl, "https://example.com/mutua.png");
    assert.equal(index.players[1].item.photoUrl, `${base}2016/08/ruben.jpg`);
    assert.deepEqual([index.players[3].item.team, index.players[3].item.active], ["Mutua Madrileña", true]);
    assert.deepEqual([index.players[4].item.team, index.players[4].item.active], [null, false]);
  });

  it("round-trips with shortenUrl", () => {
    assert.equal(shortenUrl(`${base}a.png`, base), "a.png");
    assert.equal(shortenUrl("https://example.com/a.png", base), "https://example.com/a.png");
    assert.equal(shortenUrl(null, base), null);
  });
});

describe("search", () => {
  const names = (query: string) => {
    const { teams, players } = search(index, query);
    return { teams: teams.map((t) => t.name), players: players.map((p) => p.name) };
  };

  it("finds players by the start of any word, without accents", () => {
    assert.deepEqual(names("lertx").players, ["Telmo Lertxundi"]);
    assert.deepEqual(names("inigo").players, ["Íñigo Pérez"]);
    assert.deepEqual(names("telmo ler").players, ["Telmo Lertxundi"]);
  });

  it("does not match players in the middle of a word", () => {
    assert.deepEqual(names("txundi").players, []);
  });

  it("puts whole-name prefixes first, then active teams", () => {
    // Both Rubén start with it, and Sánchez's team plays this season; Ana Rubio only has a word that does.
    assert.deepEqual(names("rub").players, ["Rubén Sánchez", "Rubén García", "Ana Rubio"]);
    assert.deepEqual(names("telefonica").teams, ["Telefónica Femenino", "Grupo Telefónica"]);
  });

  it("matches teams anywhere in the name", () => {
    assert.deepEqual(names("drile").teams, ["Mutua Madrileña"]);
  });

  it("needs two characters for players", () => {
    assert.deepEqual(names("r").players, []);
    // Embat starts with it; the rest only contain it, active teams first.
    assert.deepEqual(names("e").teams, ["Embat", "Mutua Madrileña", "Telefónica Femenino", "Grupo Telefónica"]);
  });

  it("returns nothing for an empty query", () => {
    assert.deepEqual(names("  "), { teams: [], players: [] });
  });
});
