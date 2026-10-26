import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fingerprint } from "@/notify/call-ups";
import { isRevokedWebhook, pendingByTarget, subscriptionKey } from "@/notify/targets";
import { match } from "@/test/fixtures";

const now = "2026-10-25T10:00";

describe("pendingByTarget", () => {
  const embat = match({ homeId: 1, awayId: 2, date: "2026-10-28T21:30" });
  const other = match({ homeId: 3, awayId: 4, date: "2026-10-29T21:30" });
  const derby = match({ homeId: 4, awayId: 1, date: "2026-11-02T21:30" });
  const matches = [embat, other, derby];

  it("gives each target only its team's matches", () => {
    const result = pendingByTarget(
      [
        { key: "telegram", teamId: 1 },
        { key: subscriptionKey(7), teamId: 4 },
        { key: subscriptionKey(8), teamId: 9 },
      ],
      matches,
      [],
      now,
    );
    assert.deepEqual(
      result.map((r) => [r.target.key, r.callUps.map((c) => c.match.id)]),
      [
        ["telegram", [embat.id, derby.id]],
        ["sub:7", [other.id, derby.id]],
        ["sub:8", []],
      ],
    );
  });

  it("keeps each target's record apart", () => {
    const sent = [
      { matchId: embat.id, channel: "telegram", fingerprint: fingerprint(embat) },
      { matchId: derby.id, channel: "sub:7", fingerprint: fingerprint(derby) },
    ];
    const result = pendingByTarget(
      [
        { key: "telegram", teamId: 1 },
        { key: "slack", teamId: 1 },
        { key: "sub:7", teamId: 4 },
      ],
      matches,
      sent,
      now,
    );
    assert.deepEqual(
      result.map((r) => r.callUps.map((c) => c.match.id)),
      [[derby.id], [embat.id, derby.id], [other.id]],
    );
  });
});

describe("isRevokedWebhook", () => {
  it("recognises a removed app or channel", () => {
    assert.equal(isRevokedWebhook(404, "no_service"), true);
    assert.equal(isRevokedWebhook(404, "channel_not_found"), true);
    assert.equal(isRevokedWebhook(403, "invalid_token\n"), true);
    assert.equal(isRevokedWebhook(410, "channel_is_archived"), true);
  });

  it("leaves transient and payload errors for the next run", () => {
    assert.equal(isRevokedWebhook(500, "no_service"), false);
    assert.equal(isRevokedWebhook(429, "rate_limited"), false);
    assert.equal(isRevokedWebhook(400, "invalid_payload"), false);
    assert.equal(isRevokedWebhook(200, "ok"), false);
  });
});
