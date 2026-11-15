import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expectedTotal, leaguePhaseGroups, roundRobin, roundRobinGroups } from "@/lib/expected-matches";
import { match } from "@/test/fixtures";

/** Every pair of the teams once, in group `groupId`. */
function fullRoundRobin(teams: number[], groupId: number) {
  return teams.flatMap((home, i) => teams.slice(i + 1).map((away) => match({ homeId: home, awayId: away, groupId })));
}

const always = { isRoundRobin: () => true, leaguePhaseRounds: () => undefined, belongs: () => true };

/** `teams` teams, each playing `rounds` different rivals once (the circle i–i+k for k = 1..rounds/2). */
function leaguePhase(teams: number, rounds: number, groupId: number) {
  return Array.from({ length: rounds / 2 }, (_, k) =>
    Array.from({ length: teams }, (_, i) => match({ homeId: i, awayId: (i + k + 1) % teams, groupId })),
  ).flat();
}

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

describe("leaguePhaseGroups", () => {
  it("finds a league phase and the matches each team plays", () => {
    assert.deepEqual([...leaguePhaseGroups(leaguePhase(20, 4, 30))], [[30, 4]]);
  });

  it("tolerates a team that withdrew", () => {
    const list = leaguePhase(20, 4, 30).filter((m) => m.homeId !== 0 && m.awayId !== 0);
    assert.equal(leaguePhaseGroups(list).get(30), 4);
  });

  it("drops a round robin and a knockout", () => {
    const knockout = [
      match({ homeId: 1, awayId: 2, groupId: 20 }),
      match({ homeId: 3, awayId: 4, groupId: 20 }),
      match({ homeId: 5, awayId: 6, groupId: 20 }),
      match({ homeId: 7, awayId: 8, groupId: 20 }),
      match({ homeId: 1, awayId: 3, groupId: 20 }),
      match({ homeId: 5, awayId: 7, groupId: 20 }),
      match({ homeId: 1, awayId: 5, groupId: 20 }),
    ];
    assert.equal(leaguePhaseGroups([...fullRoundRobin([1, 2, 3, 4, 5], 10), ...knockout]).size, 0);
  });
});

describe("expectedTotal", () => {
  it("counts every round of a league phase with only its first published", () => {
    // 30 teams, 4 rivals each: 60 matches, 15 published.
    const list = Array.from({ length: 15 }, (_, i) => match({ homeId: 2 * i, awayId: 2 * i + 1, groupId: 30 }));
    assert.equal(expectedTotal(list, { ...always, isRoundRobin: () => false, leaguePhaseRounds: () => 4 }), 60);
  });

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
