import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeHtml,
  extractFlickrPhotos,
  extractHeaderMediaId,
  extractYoutubeUrl,
  isPlaceholderTeamPhoto,
  parseEventTitle,
  parseGoals,
  parseMatchVideo,
  toNumber,
} from "@/lib/sportspress/parse";

describe("parseEventTitle", () => {
  it("reads the round and both teams, decoding entities", () => {
    assert.deepEqual(parseEventTitle("J3 &#8211; EY Abogados vs Embat"), { round: 3, home: "EY Abogados", away: "Embat" });
    assert.deepEqual(parseEventTitle("J12 - Procter &amp; Gamble vs BBVA"), { round: 12, home: "Procter & Gamble", away: "BBVA" });
  });

  it("reads a round stuck to the name", () => {
    assert.deepEqual(parseEventTitle("J1- Simon Kucher vs Kearney"), { round: 1, home: "Simon Kucher", away: "Kearney" });
  });

  it("works without a round", () => {
    assert.deepEqual(parseEventTitle("Telefónica Femenino vs Sanitas Femenino"), {
      round: null,
      home: "Telefónica Femenino",
      away: "Sanitas Femenino",
    });
  });

  it("keeps dashes inside team names", () => {
    assert.deepEqual(parseEventTitle("J4 &#8211; Deloitte - Strategy vs EY &#8211; Data"), {
      round: 4,
      home: "Deloitte - Strategy",
      away: "EY – Data",
    });
  });
});

describe("parseGoals", () => {
  it("reads the count and the minutes", () => {
    assert.deepEqual(parseGoals("2 (42', 44')"), { count: 2, minutes: [42, 44] });
  });

  it("reads a count without minutes", () => {
    assert.deepEqual(parseGoals("1"), { count: 1, minutes: [] });
    assert.deepEqual(parseGoals(3), { count: 3, minutes: [] });
  });

  it("treats empty or missing values as no goals", () => {
    assert.deepEqual(parseGoals(""), { count: 0, minutes: [] });
    assert.deepEqual(parseGoals(undefined), { count: 0, minutes: [] });
  });
});

describe("toNumber", () => {
  it("reads numbers, decimal commas and junk", () => {
    assert.equal(toNumber(4), 4);
    assert.equal(toNumber("13,5"), 13.5);
    assert.equal(toNumber(""), 0);
    assert.equal(toNumber("abc"), 0);
    assert.equal(toNumber(null), 0);
  });
});

describe("decodeHtml", () => {
  it("decodes numeric, hex and named entities and keeps unknown ones", () => {
    assert.equal(decodeHtml(" Caf&#233; &#x2013; R&amp;D &foo; "), "Café – R&D &foo;");
  });
});

// Content arrives as unrendered WPBakery shortcodes with typographic quotes in the attributes.
describe("shortcodes", () => {
  it("finds the YouTube link in vc_video", () => {
    assert.equal(extractYoutubeUrl("[vc_video link=&#8221;https://www.youtube.com/playlist?list=PL123&#8243;]"), "https://www.youtube.com/playlist?list=PL123");
    assert.equal(extractYoutubeUrl('[vc_video link="https://youtu.be/abcdefghijk"]'), "https://youtu.be/abcdefghijk");
    assert.equal(extractYoutubeUrl("[vc_column_text]Nada[/vc_column_text]"), null);
    assert.equal(extractYoutubeUrl(undefined), null);
  });

  it("finds the header image id in vc_single_image", () => {
    assert.equal(extractHeaderMediaId("[vc_row][vc_single_image image=&#8221;48213&#8243; img_size=&#8221;full&#8221;]"), 48213);
    assert.equal(extractHeaderMediaId(""), null);
  });

  it("collects Flickr photos once, in large size", () => {
    const html =
      '<img src="https://live.staticflickr.com/65535/1_abc_z.jpg"> <a href="https://live.staticflickr.com/65535/1_abc.jpg"></a> https://live.staticflickr.com/65535/2_def_m.jpg';
    assert.deepEqual(extractFlickrPhotos(html), [
      "https://live.staticflickr.com/65535/1_abc_b.jpg",
      "https://live.staticflickr.com/65535/2_def_b.jpg",
    ]);
  });

  it("ignores the silhouette header template", () => {
    assert.equal(isPlaceholderTeamPhoto("https://www.futbolempresas.es/wp-content/uploads/2024/09/EMBAT-CABECERA.jpg"), true);
    assert.equal(isPlaceholderTeamPhoto("https://live.staticflickr.com/65535/1_abc_b.jpg"), false);
  });
});

describe("parseMatchVideo", () => {
  it("reads the video hidden behind the cookie banner, with its title", () => {
    const html = `<div class="sp-template sp-event-video"><iframe title="Resumen J4 &#8211; Embat" data-wpca-marked-data="{&quot;src&quot;:&quot;https:\\/\\/www.youtube-nocookie.com\\/embed\\/dQw4w9WgXcQ?feature=oembed&quot;}"></iframe></div>`;
    assert.deepEqual(parseMatchVideo(html), { id: "dQw4w9WgXcQ", title: "Resumen J4 – Embat" });
  });

  it("reads a plain embed without a title", () => {
    assert.deepEqual(parseMatchVideo('<div class="sp-event-video"><iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe></div>'), {
      id: "abcdefghijk",
      title: null,
    });
  });

  it("is null when the page has no video section or no YouTube link", () => {
    assert.equal(parseMatchVideo('<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>'), null);
    assert.equal(parseMatchVideo('<div class="sp-event-video"><p>Pronto</p></div>'), null);
  });
});
