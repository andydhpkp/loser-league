const test = require("node:test");
const assert = require("node:assert/strict");
const { inferPreseasonWeek, nextPreseasonWeek } = require("../../server/modules/league-season/preseason-policy");

test("infers the earliest preseason week with an unfinished game", () => {
  assert.equal(inferPreseasonWeek([
    { week: 1, games: [{ completed: true }] },
    { week: 2, games: [{ completed: true }, { completed: false }] },
    { week: 3, games: [{ completed: false }] },
  ]), 2);
});

test("returns no preseason week when every game is complete", () => {
  assert.equal(inferPreseasonWeek([{ week: 1, games: [{ completed: true }] }]), null);
});

test("advancement skips completed preseason weeks", () => {
  assert.equal(nextPreseasonWeek(1, [
    { week: 2, games: [{ completed: true }] },
    { week: 3, games: [{ completed: false }] },
  ]), 3);
});
