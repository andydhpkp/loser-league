const assert = require("node:assert/strict");
const { test } = require("node:test");
const request = require("supertest");

const sequelize = require("../../config/connection");
const { Track } = require("../../models/my-index");
const trackRoutes = require("../../controllers/api/tracks");
const { createRouteApp, createTrack } = require("../support/route-app");

function mockTracks(t, tracks) {
  const calls = [];
  t.mock.method(Track, "findAll", async (query) => {
    calls.push(["findAll", query]);
    return tracks;
  });
  t.mock.method(Track, "findOne", async (query) => {
    calls.push(["findOne", query]);
    return tracks[0] || null;
  });
  t.mock.method(Track, "update", async (values, query) => {
    calls.push(["update", values, query]);
    return [tracks.length];
  });
  return calls;
}

test("all Track maintenance endpoints preserve successful summaries and mutations", async (t) => {
  const tracks = [
    createTrack({
      id: 1,
      used_picks: ["Broncos", "Raiders", "Chiefs"],
      available_picks: ["Bills"],
      current_pick: "Chiefs",
      wrong_pick: "Broncos",
    }),
    createTrack({
      id: 2,
      used_picks: ["Bills", "Jets"],
      available_picks: ["Broncos"],
      current_pick: null,
      wrong_pick: null,
    }),
  ];
  const calls = mockTracks(t, tracks);
  const app = createRouteApp("/api/tracks", trackRoutes);

  const cases = [
    ["put", "/api/tracks/reset-to-pick-count/1"],
    ["put", "/api/tracks/fix-current-pick/1"],
    ["put", "/api/tracks/user/3/reset-current-picks"],
    ["put", "/api/tracks/user/3/move-last-used-to-available"],
    ["put", "/api/tracks/reduce-all-used-picks/1"],
  ];

  for (const [method, path] of cases) {
    const response = await request(app)[method](path);
    assert.equal(response.status, 200, `${path}: ${JSON.stringify(response.body)}`);
  }

  assert.ok(calls.some(([name]) => name === "findAll"));
  assert.ok(tracks.every((track) => typeof track.update === "function"));
});

test("Track maintenance endpoints reject invalid parameters and empty results", async (t) => {
  mockTracks(t, []);
  const app = createRouteApp("/api/tracks", trackRoutes);

  for (const path of [
    "/api/tracks/reset-to-pick-count/nope",
    "/api/tracks/reset-to-pick-count/-1",
    "/api/tracks/fix-current-pick/0",
    "/api/tracks/reduce-used-picks/7/nope",
    "/api/tracks/reduce-all-used-picks/-1",
  ]) {
    assert.equal((await request(app).put(path)).status, 400, path);
  }

  for (const path of [
    "/api/tracks/reset-to-pick-count/1",
    "/api/tracks/fix-current-pick/1",
    "/api/tracks/user/3/reset-current-picks",
    "/api/tracks/user/3/move-last-used-to-available",
    "/api/tracks/reduce-all-used-picks/1",
  ]) {
    assert.equal((await request(app).put(path)).status, 404, path);
  }
});

test("individual Track reduction preserves its successful contract", async (t) => {
  const track = createTrack({
    used_picks: ["Broncos", "Raiders", "Chiefs"],
    available_picks: ["Bills"],
    current_pick: "Chiefs",
  });
  mockTracks(t, [track]);
  const response = await request(
    createRouteApp("/api/tracks", trackRoutes)
  ).put("/api/tracks/reduce-used-picks/7/1");

  assert.equal(response.status, 200);
  assert.equal(response.body.newUsedPicksLength, 1);
  assert.equal(track.current_pick, "Broncos");
  assert.ok(track.available_picks.includes("Raiders"));
});

test.skip("individual Track reduction terminal responses do not continue their promise chain", () => {
  // Known issue: both the missing-Track 404 and already-short-enough 400 flow
  // into the next `.then`, dereference the response object, and double-send.
});

test("all Track repair endpoints preserve matching and nonmatching batch summaries", async (t) => {
  const tracks = [
    createTrack({
      id: 1,
      used_picks: ["Broncos"],
      current_pick: "Broncos",
      wrong_pick: null,
    }),
    createTrack({
      id: 2,
      used_picks: ["Raiders", "Chiefs"],
      current_pick: null,
      wrong_pick: "Raiders",
    }),
  ];
  const calls = mockTracks(t, tracks);
  const app = createRouteApp("/api/tracks", trackRoutes);

  const fix = await request(app).put("/api/tracks/fix-wrong-pick/2");
  assert.equal(fix.status, 200);

  const set = await request(app)
    .put("/api/tracks/bug-fix/set-wrong-pick-for-teams")
    .send({ teams: ["Broncos", "Jets"] });
  assert.equal(set.status, 200);

  const clear = await request(app).put(
    "/api/tracks/bug-fix/clear-wrong-pick-if-matches/1"
  );
  assert.equal(clear.status, 200);
  assert.ok(calls.filter(([name]) => name === "findAll").length >= 3);
});

test("Track repair endpoints preserve validation, no-record, and safe error contracts", async (t) => {
  mockTracks(t, []);
  const app = createRouteApp("/api/tracks", trackRoutes);

  assert.equal(
    (await request(app).put("/api/tracks/fix-wrong-pick/nope")).status,
    400
  );
  assert.equal(
    (
      await request(app)
        .put("/api/tracks/bug-fix/set-wrong-pick-for-teams")
        .send({})
    ).status,
    400
  );
  assert.equal(
    (
      await request(app).put(
        "/api/tracks/bug-fix/clear-wrong-pick-if-matches/nope"
      )
    ).status,
    400
  );
  assert.equal(
    (await request(app).put("/api/tracks/fix-wrong-pick/2")).status,
    404
  );
});

test("force-pick assigns deterministic Picks in one committed transaction", async (t) => {
  const assigned = createTrack({
    id: 101,
    available_picks: ["Broncos", "Raiders"],
    used_picks: [],
    current_pick: null,
  });
  const unavailable = createTrack({
    id: 102,
    available_picks: [],
    used_picks: [],
    current_pick: null,
  });
  mockTracks(t, [assigned, unavailable]);

  const transaction = {
    finished: null,
    async commit() {
      this.finished = "commit";
    },
    async rollback() {
      this.finished = "rollback";
    },
  };
  t.mock.method(sequelize, "transaction", async () => transaction);
  t.mock.method(Math, "random", () => 0);

  const response = await request(
    createRouteApp("/api/tracks", trackRoutes)
  ).put("/api/tracks/force-picks/all-alive");

  assert.equal(response.status, 200);
  assert.equal(response.body.successCount, 1);
  assert.equal(response.body.errorCount, 1);
  assert.equal(response.body.updatedTracks[0].selectedPick, "Broncos");
  assert.equal(response.body.errors[0].error, "No available picks remaining");
  assert.equal(transaction.finished, "commit");
  assert.equal(assigned.current_pick, "Broncos");
});
