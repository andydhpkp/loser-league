const assert = require("node:assert/strict");
const test = require("node:test");

const {
  makePick,
  replaceCurrentPick,
} = require("../../server/modules/tracks/pick-state");

test("makePick moves an available team to used picks without mutating input", () => {
  const state = {
    availablePicks: ["Broncos", "Raiders", "Chiefs"],
    usedPicks: ["Chargers"],
    currentPick: null,
  };

  const result = makePick(state, "Raiders");

  assert.deepEqual(result, {
    availablePicks: ["Broncos", "Chiefs"],
    usedPicks: ["Chargers", "Raiders"],
    currentPick: "Raiders",
  });
  assert.deepEqual(state.availablePicks, ["Broncos", "Raiders", "Chiefs"]);
});

test("makePick preserves legacy behavior when the requested team is unavailable", () => {
  const result = makePick(
    {
      availablePicks: ["Broncos"],
      usedPicks: ["Raiders"],
      currentPick: "Broncos",
    },
    "Chiefs"
  );

  assert.deepEqual(result, {
    availablePicks: ["Broncos"],
    usedPicks: ["Raiders"],
    currentPick: "Chiefs",
  });
});

test("replaceCurrentPick restores the prior pick and consumes the replacement", () => {
  const result = replaceCurrentPick(
    {
      availablePicks: ["Broncos", "Raiders"],
      usedPicks: ["Chiefs"],
      currentPick: "Chiefs",
    },
    "Raiders"
  );

  assert.deepEqual(result, {
    availablePicks: ["Broncos", "Chiefs"],
    usedPicks: ["Chiefs", "Raiders"].filter((pick) => pick !== "Chiefs"),
    currentPick: "Raiders",
  });
});
