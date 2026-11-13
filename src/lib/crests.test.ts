import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crestSrc, leagueCrestUrl } from "@/lib/crests";

const league = "https://www.futbolempresas.es/wp-content/uploads/2016/08/SANITAS-LOGO-128x128.jpg";

describe("crestSrc", () => {
  it("points a league crest at the site's copy", () => {
    assert.equal(crestSrc(league), "/escudos/2016/08/SANITAS-LOGO-128x128.jpg");
  });

  it("leaves other URLs and missing crests alone", () => {
    assert.equal(crestSrc("https://example.com/logo.png"), "https://example.com/logo.png");
    assert.equal(crestSrc(null), null);
  });
});

describe("leagueCrestUrl", () => {
  it("rebuilds the league URL from the path", () => {
    assert.equal(leagueCrestUrl(["2016", "08", "SANITAS-LOGO-128x128.jpg"]), league);
  });

  it("refuses paths that cannot be a crest", () => {
    assert.equal(leagueCrestUrl([]), null);
    assert.equal(leagueCrestUrl(["..", "secret"]), null);
    assert.equal(leagueCrestUrl(["2016", "a b.jpg"]), null);
  });
});
