import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pendingCallUps } from "@/notify/call-ups";
import { describeSchedule, parseSchedule, sendAt } from "@/notify/schedule";
import { match } from "@/test/fixtures";

// 2026-11-03 is a Tuesday.
const thursday = { weekday: 4, time: "10:00" };

describe("sendAt", () => {
  it("is the last chosen weekday strictly before the match", () => {
    assert.equal(sendAt("2026-11-03T21:00", thursday), "2026-10-29T10:00"); // Tuesday → Thursday before
    assert.equal(sendAt("2026-11-04T21:00", thursday), "2026-10-29T10:00"); // Wednesday
    assert.equal(sendAt("2026-11-06T21:00", thursday), "2026-11-05T10:00"); // Friday → the day before
    assert.equal(sendAt("2026-11-05T21:00", thursday), "2026-10-29T10:00"); // Thursday → a week before
  });
});

describe("parseSchedule", () => {
  it("accepts weekdays and whole hours from the options only", () => {
    assert.deepEqual(parseSchedule("1", "07:00"), { weekday: 1, time: "07:00" });
    assert.equal(parseSchedule("6", "10:00"), null);
    assert.equal(parseSchedule("4", "10:30"), null);
    assert.equal(parseSchedule(null, null), null);
  });
});

describe("describeSchedule", () => {
  it("reads as Spanish", () => {
    assert.equal(describeSchedule(thursday), "el jueves antes de cada partido, a las 10:00");
  });
});

describe("pendingCallUps with a schedule", () => {
  const game = match({ homeId: 1, awayId: 2, date: "2026-11-03T21:00", venueId: 110 });

  it("waits for its time and sends it then", () => {
    assert.deepEqual(pendingCallUps([game], new Map(), "2026-10-29T09:59", thursday), []);
    assert.equal(pendingCallUps([game], new Map(), "2026-10-29T10:00", thursday).length, 1);
  });

  it("sends at once when subscribed after its time", () => {
    assert.equal(pendingCallUps([game], new Map(), "2026-11-02T18:00", thursday)[0].kind, "new");
  });

  it("sends a change to an announced match straight away", () => {
    const moved = { ...game, date: "2026-11-10T21:00" };
    const sent = new Map([[game.id, "2026-11-03T21:00|110"]]);
    assert.equal(pendingCallUps([moved], sent, "2026-10-30T12:00", thursday)[0].kind, "rescheduled");
  });
});
