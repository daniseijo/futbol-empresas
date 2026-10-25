import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { longestWord } from "@/lib/text";

describe("longestWord", () => {
  it("measures the longest word, not the whole name", () => {
    assert.equal(longestWord("Sociedad Anónima de Servicios Financieros Internacionales"), 15);
    assert.equal(longestWord("Telecomunicaciones"), 18);
  });

  it("handles short and empty names", () => {
    assert.equal(longestWord("EY"), 2);
    assert.equal(longestWord(""), 0);
  });
});
