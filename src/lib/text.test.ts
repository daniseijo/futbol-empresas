import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitFontSize, fitPixelSize, longestWord } from "@/lib/text";

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

describe("fitPixelSize", () => {
  const box = { width: 330, base: 54, min: 32, maxLines: 3, emPerChar: 0.46 };

  it("keeps the base size for names that fit, however many letters they have", () => {
    assert.equal(fitPixelSize("Embat", box), 54);
    assert.equal(fitPixelSize("Telefónica Femenino", box), 54);
    assert.equal(fitPixelSize("Banco Santander Global Tech", box), 54);
  });

  it("shrinks a word too long for the width", () => {
    assert.equal(fitPixelSize("Telecomunicaciones", box), 38);
  });

  it("shrinks a name that would take too many lines", () => {
    assert.equal(fitPixelSize("Banco de Crédito y Ahorro del Sur de Madrid", box), 44);
  });

  it("stops at the minimum", () => {
    assert.equal(fitPixelSize("Supercalifragilisticoespialidoso", box), 32);
  });
});
