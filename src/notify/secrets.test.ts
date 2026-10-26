import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { decrypt, encrypt, encryptionKey, signState, signSubscription, verifyState, verifySubscription } from "@/notify/secrets";

describe("encrypt / decrypt", () => {
  const key = randomBytes(32);
  const url = "https://hooks.slack.com/services/T000/B000/XXXX";

  it("round-trips, with a different ciphertext every time", () => {
    const a = encrypt(url, key);
    assert.equal(decrypt(a, key), url);
    assert.notEqual(a, encrypt(url, key));
    assert.doesNotMatch(a, /hooks\.slack\.com/);
  });

  it("refuses another key or a tampered value", () => {
    const value = encrypt(url, key);
    assert.throws(() => decrypt(value, randomBytes(32)));
    const parts = value.split(".");
    parts[3] = Buffer.from("https://evil.example").toString("base64url");
    assert.throws(() => decrypt(parts.join("."), key));
    assert.throws(() => decrypt(url, key));
  });

  it("reads the key from base64 and checks its length", () => {
    assert.equal(encryptionKey(key.toString("base64")).length, 32);
    assert.throws(() => encryptionKey(randomBytes(16).toString("base64")));
    assert.throws(() => encryptionKey(undefined));
  });
});

describe("signState / verifyState", () => {
  const key = "client-secret";
  const now = 1_800_000_000_000;
  const state = { slug: "embat", weekday: 4, time: "10:00", nonce: "abc", expiresAt: now + 60_000 };

  it("accepts its own state from the same browser", () => {
    assert.deepEqual(verifyState(signState(state, key), key, "abc", now), state);
  });

  it("rejects another browser, an expired state, another key and a forged payload", () => {
    const signed = signState(state, key);
    assert.equal(verifyState(signed, key, "other", now), null);
    assert.equal(verifyState(signed, key, undefined, now), null);
    assert.equal(verifyState(signed, key, "abc", now + 120_000), null);
    assert.equal(verifyState(signed, "another-secret", "abc", now), null);
    const forged = Buffer.from(JSON.stringify({ ...state, slug: "otro" })).toString("base64url");
    assert.equal(verifyState(`${forged}.${signed.split(".")[1]}`, key, "abc", now), null);
    assert.equal(verifyState("garbage", key, "abc", now), null);
  });
});

describe("signSubscription / verifySubscription", () => {
  const key = randomBytes(32);

  it("gives back the id of a genuine token only", () => {
    assert.equal(verifySubscription(signSubscription(7, key), key), 7);
    assert.equal(verifySubscription(signSubscription(7, key), randomBytes(32)), null);
    assert.equal(verifySubscription(signSubscription(7, key).replace(/^7/, "8"), key), null);
    assert.equal(verifySubscription("7", key), null);
    assert.equal(verifySubscription("", key), null);
  });
});
