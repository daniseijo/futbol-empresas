import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { callUpMessage, fingerprint, NOTIFY_DAYS, pendingCallUps, toSlackMessage, toTelegramHtml } from "@/notify/call-ups";
import { match } from "@/test/fixtures";

const now = "2026-10-25T10:00";

describe("pendingCallUps", () => {
  const soon = match({ homeId: 1, awayId: 2, date: "2026-10-28T21:30", venueId: 110 });

  it("announces an upcoming match the channel has not announced", () => {
    assert.deepEqual(pendingCallUps([soon], new Map(), now), [{ match: soon, kind: "new", fingerprint: fingerprint(soon) }]);
  });

  it("does not announce it twice", () => {
    assert.deepEqual(pendingCallUps([soon], new Map([[soon.id, fingerprint(soon)]]), now), []);
  });

  it("announces it again when its date or venue changes", () => {
    const sent = new Map([[soon.id, fingerprint(soon)]]);
    const moved = { ...soon, date: "2026-10-29T20:00" };
    const otherVenue = { ...soon, venueId: 109 };
    assert.equal(pendingCallUps([moved], sent, now)[0].kind, "rescheduled");
    assert.equal(pendingCallUps([otherVenue], sent, now)[0].kind, "rescheduled");
  });

  it(`waits until the match is ${NOTIFY_DAYS} days away`, () => {
    const far = match({ homeId: 1, awayId: 2, date: "2026-11-09T21:00" });
    const edge = match({ homeId: 1, awayId: 2, date: "2026-11-08T21:00" });
    assert.deepEqual(
      pendingCallUps([far, edge], new Map(), now).map((c) => c.match.id),
      [edge.id],
    );
  });

  it("skips past and played matches", () => {
    const past = match({ homeId: 1, awayId: 2, date: "2026-10-24T21:00" });
    const scored = match({ homeId: 1, awayId: 2, date: "2026-10-26T21:00", homeGoals: 1, awayGoals: 0 });
    assert.deepEqual(pendingCallUps([past, scored], new Map(), now), []);
  });

  it("lists the soonest first", () => {
    const later = match({ homeId: 1, awayId: 2, date: "2026-11-04T21:00" });
    assert.deepEqual(
      pendingCallUps([later, soon], new Map(), now).map((c) => c.match.id),
      [soon.id, later.id],
    );
  });
});

describe("callUpMessage", () => {
  const game = match({ homeId: 1, awayId: 2, homeName: "Embat", awayName: "R&D <Labs>", date: "2026-11-04T21:30", round: 7, venueId: 110 });

  it("says when, where and against whom", () => {
    const message = callUpMessage({ match: game, kind: "new", fingerprint: fingerprint(game) }, 1, now);
    assert.equal(message.title, "Convocatoria · Jornada 7");
    assert.equal(message.matchup, "Embat vs R&D <Labs>");
    assert.equal(message.when, "Miércoles 4 de noviembre · 21:30");
    assert.equal(message.venue?.name, "La Elipa");
    assert.match(message.url, new RegExp(`/partidos/${game.id}$`));
    assert.match(message.imageUrl, new RegExp(`/partidos/${game.id}/opengraph-image\\?v=2026-11-04T21%3A30%7C110$`));
    assert.equal(message.question, "¿Vas el miércoles 4 contra R&D <Labs>?");
  });

  it("names the rival when the team plays away", () => {
    const message = callUpMessage({ match: game, kind: "new", fingerprint: "" }, 2, now);
    assert.equal(message.question, "¿Vas el miércoles 4 contra Embat?");
  });

  it("flags a rescheduled match and works without a round or a known venue", () => {
    const bare = { ...game, round: null, venueId: 99999 };
    const message = callUpMessage({ match: bare, kind: "rescheduled", fingerprint: "" }, 1, now);
    assert.equal(message.title, "Cambio de horario");
    assert.equal(message.venue, null);
  });

  it("escapes team names for Telegram and Slack", () => {
    const message = callUpMessage({ match: game, kind: "new", fingerprint: "" }, 1, now);
    assert.match(toTelegramHtml(message), /<b>Embat vs R&amp;D &lt;Labs&gt;<\/b>/);
    assert.match(JSON.stringify(toSlackMessage(message).blocks), /\*Embat vs R&amp;D &lt;Labs&gt;\*/);
    assert.doesNotMatch(toTelegramHtml({ ...message, venue: null }), /📍/);
  });

  it("lays out Slack with blocks and the match image, without link previews", () => {
    const slack = toSlackMessage(callUpMessage({ match: game, kind: "new", fingerprint: fingerprint(game) }, 1, now));
    assert.equal(slack.text, "Convocatoria · Jornada 7: Embat vs R&D <Labs>, Miércoles 4 de noviembre · 21:30");
    assert.deepEqual(
      slack.blocks.map((b) => b.type),
      ["header", "section", "image", "section", "context"],
    );
    assert.equal(slack.unfurl_links, false);
    assert.equal(slack.unfurl_media, false);
  });
});
