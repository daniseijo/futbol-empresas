import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expectedTotal, roundRobin, roundRobinGroups } from "@/lib/expected-matches";
import { match } from "@/test/fixtures";

/** Every pair of the teams once, in group `groupId`. */
function fullRoundRobin(teams: number[], groupId: number) {
  return teams.flatMap((home, i) => teams.slice(i + 1).map((away) => match({ homeId: home, awayId: away, groupId })));
}

const always = { isRoundRobin: () => true, belongs: () => true };

describe("roundRobin", () => {
  it("counts one match per pair", () => {
    assert.equal(roundRobin(9), 36);
    assert.equal(roundRobin(2), 1);
  });
});

describe("roundRobinGroups", () => {
  it("keeps a complete round robin", () => {
    assert.deepEqual([...roundRobinGroups(fullRoundRobin([1, 2, 3, 4], 10))], [10]);
  });

  it("keeps a round robin cut short near the end", () => {
    const list = fullRoundRobin([1, 2, 3, 4, 5, 6, 7, 8, 9], 10).slice(0, 29);
    assert.ok(roundRobinGroups(list).has(10));
  });

  it("drops a knockout and a league phase where each team plays a few rivals", () => {
    const knockout = [match({ homeId: 1, awayId: 2, groupId: 20 }), match({ homeId: 3, awayId: 4, groupId: 20 }), match({ homeId: 1, awayId: 3, groupId: 20 })];
    const fewRivals = Array.from({ length: 10 }, (_, i) => match({ homeId: i, awayId: (i + 1) % 10, groupId: 30 }));
    assert.equal(roundRobinGroups([...knockout, ...fewRivals]).size, 0);
  });

  it("drops a group where a pair met twice", () => {
    const list = [...fullRoundRobin([1, 2, 3], 10), match({ homeId: 2, awayId: 1, groupId: 10 })];
    assert.equal(roundRobinGroups(list).size, 0);
  });
});

describe("expectedTotal", () => {
  it("counts the whole round robin of a group with only its first rounds published", () => {
    // Nine teams, one round of four matches published.
    const list = [1, 3, 5, 7].map((home) => match({ homeId: home, awayId: home + 1, groupId: 10 }));
    list.push(match({ homeId: 9, awayId: 1, groupId: 10 }));
    assert.equal(expectedTotal(list, always), 36);
  });

  it("leaves out teams registered in another group", () => {
    const list = [...fullRoundRobin([1, 2, 3], 10), match({ homeId: 8, awayId: 9, groupId: 10 })];
    const belongs = (teamId: number) => teamId < 8;
    assert.equal(expectedTotal(list, { ...always, belongs }), 4);
  });

  it("counts the published matches outside round robins", () => {
    const list = [match({ homeId: 1, awayId: 2, groupId: 20 }), match({ homeId: 3, awayId: 4, groupId: 20 })];
    assert.equal(expectedTotal(list, { ...always, isRoundRobin: () => false }), 2);
  });

  it("never counts fewer than the published matches", () => {
    const list = [...fullRoundRobin([1, 2, 3], 10), ...fullRoundRobin([1, 2, 3], 10)];
    assert.equal(expectedTotal(list, always), 6);
  });
});
