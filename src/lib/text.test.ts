import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitFontSize, longestWord } from "@/lib/text";

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

describe("fitFontSize", () => {
  it("divides the width by the longest word's width in ems", () => {
    assert.equal(fitFontSize("Telecomunicaciones", 0.5), "clamp(var(--min), calc(var(--fit-width, 100cqi) / 9), var(--base))");
    assert.equal(fitFontSize("EY Abogados", 0.55), "clamp(var(--min), calc(var(--fit-width, 100cqi) / 4.4), var(--base))");
  });

  it("never divides by zero", () => {
    assert.equal(fitFontSize("", 0.5), "clamp(var(--min), calc(var(--fit-width, 100cqi) / 0.5), var(--base))");
  });
});
