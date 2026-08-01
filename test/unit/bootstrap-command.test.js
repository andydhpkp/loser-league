const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseBootstrapArguments,
} = require("../../scripts/bootstrap-league-season");

test("bootstrap command requires explicit lifecycle input and defaults to dry-run", () => {
  assert.deepEqual(
    parseBootstrapArguments([
      "--year",
      "2026",
      "--state",
      "ACTIVE",
      "--week",
      "3",
    ]),
    { year: 2026, state: "ACTIVE", week: 3, apply: false }
  );
  assert.deepEqual(
    parseBootstrapArguments([
      "--year",
      "2026",
      "--state",
      "SETUP",
      "--week",
      "0",
      "--apply",
      "--week-one-buyback-track",
      "42",
      "--week-one-buyback-track",
      "57",
    ]),
    {
      year: 2026,
      state: "SETUP",
      week: 0,
      apply: true,
      weekOneBuybackTrackIds: [42, 57],
    }
  );

  assert.throws(() => parseBootstrapArguments([]), /--year/);
  assert.throws(
    () =>
      parseBootstrapArguments([
        "--year",
        "2026",
        "--state",
        "ACTIVE",
        "--week",
        "3",
        "--tracks",
        "all",
      ]),
    /Unknown argument/
  );
});
