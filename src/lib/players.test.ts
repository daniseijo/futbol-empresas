import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { playerDisplayName } from "@/lib/players";

describe("playerDisplayName", () => {
  it("keeps a player's name", () => {
    assert.equal(playerDisplayName("Leah Kochendoerfer", "15"), "Leah Kochendoerfer");
  });

  it("shows a private player by shirt number", () => {
    assert.equal(playerDisplayName("", "7"), "Dorsal\u00a07");
  });

  it("falls back to a generic label without a number", () => {
    assert.equal(playerDisplayName("", null), "Jugador");
    assert.equal(playerDisplayName(undefined), "Jugador");
  });
});
