import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, daysBetween, relativeDay } from "@/lib/dates";

describe("daysBetween", () => {
  it("ignores the time of day", () => {
    assert.equal(daysBetween("2026-10-22T23:59", "2026-10-23T00:01"), 1);
    assert.equal(daysBetween("2026-10-22T00:00", "2026-10-22T23:59"), 0);
  });

  it("crosses month and year boundaries", () => {
    assert.equal(daysBetween("2026-10-30T20:00", "2026-11-02T21:00"), 3);
    assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
    assert.equal(daysBetween("2026-11-02", "2026-10-30"), -3);
  });

  it("is not thrown off by the daylight saving change (25 Oct 2026 in Madrid)", () => {
    assert.equal(daysBetween("2026-10-24T21:00", "2026-10-26T21:00"), 2);
  });
});

describe("relativeDay", () => {
  const today = "2026-10-31T12:00";
  it("names today, tomorrow and yesterday across a month boundary", () => {
    assert.equal(relativeDay("2026-10-31T21:00", today), "Hoy");
    assert.equal(relativeDay("2026-11-01T20:00", today), "Mañana");
    assert.equal(relativeDay("2026-10-30T20:00", today), "Ayer");
  });

  it("falls back to the short date", () => {
    assert.equal(relativeDay("2026-11-02T20:00", today), "Lun 2 nov");
  });
});

describe("addDays", () => {
  it("crosses months", () => {
    assert.equal(addDays("2026-10-30", 3), "2026-11-02");
    assert.equal(addDays("2026-03-01T10:00", -1), "2026-02-28");
  });
});
