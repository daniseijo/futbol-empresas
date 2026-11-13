import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crestSrc, leagueUploadUrl, photoSrc } from "@/lib/uploads";

const crest = "https://www.futbolempresas.es/wp-content/uploads/2016/08/SANITAS-LOGO-128x128.jpg";

describe("crestSrc and photoSrc", () => {
  it("point a league file at the site's copy", () => {
    assert.equal(crestSrc(crest), "/escudos/2016/08/SANITAS-LOGO-128x128.jpg");
    assert.equal(photoSrc("https://www.futbolempresas.es/wp-content/uploads/2023/09/QLM-Roberto.jpg"), "/fotos/2023/09/QLM-Roberto.jpg");
  });

  it("leave other URLs and missing files alone", () => {
    assert.equal(crestSrc("https://example.com/logo.png"), "https://example.com/logo.png");
    assert.equal(photoSrc(null), null);
  });
});

describe("leagueUploadUrl", () => {
  it("rebuilds the league URL from the path", () => {
    assert.equal(leagueUploadUrl(["2016", "08", "SANITAS-LOGO-128x128.jpg"]), crest);
  });

  it("refuses paths that cannot be a league file", () => {
    assert.equal(leagueUploadUrl([]), null);
    assert.equal(leagueUploadUrl(["..", "secret"]), null);
    assert.equal(leagueUploadUrl(["2016", "a b.jpg"]), null);
  });
});
