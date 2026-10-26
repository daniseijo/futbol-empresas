import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, daysBetween, formatLongDate, formatShortDate, relativeDay, resultOverdue } from "@/lib/dates";

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

describe("formatShortDate and formatLongDate", () => {
  const today = "2026-10-31T12:00";
  it("leave the year out when it is this year or no reference day is given", () => {
    assert.equal(formatShortDate("2026-10-15T20:00", today), "Jue 15 oct");
    assert.equal(formatLongDate("2026-10-15T20:00", today), "jueves 15 de octubre");
    assert.equal(formatShortDate("2024-10-17T20:00"), "Jue 17 oct");
  });

  it("add the year when it is another year", () => {
    assert.equal(formatShortDate("2024-10-17T20:00", today), "Jue 17 oct 2024");
    assert.equal(formatLongDate("2024-10-17T20:00", today), "jueves 17 de octubre de 2024");
    assert.equal(relativeDay("2027-01-14T20:00", today), "Jue 14 ene 2027");
  });
});

describe("addDays", () => {
  it("crosses months", () => {
    assert.equal(addDays("2026-10-30", 3), "2026-11-02");
    assert.equal(addDays("2026-03-01T10:00", -1), "2026-02-28");
  });
});

describe("resultOverdue", () => {
  it("waits a full day after kickoff", () => {
    assert.equal(resultOverdue("2026-10-22T21:00", "2026-10-22T20:59"), false);
    assert.equal(resultOverdue("2026-10-22T21:00", "2026-10-22T22:30"), false);
    assert.equal(resultOverdue("2026-10-22T21:00", "2026-10-23T20:59"), false);
    assert.equal(resultOverdue("2026-10-22T21:00", "2026-10-23T21:00"), true);
  });

  it("is never overdue without a current time", () => {
    assert.equal(resultOverdue("2020-01-01T10:00", ""), false);
  });
});
