const assert = require("node:assert/strict");
const { test } = require("node:test");
const request = require("supertest");

const { Track } = require("../../models/my-index");
const trackRoutes = require("../../controllers/api/tracks");
const { createRouteApp, createTrack, mockLegacyEmergencyPersistence } = require("../support/route-app");

function stubTrackModel(t, { tracks = [createTrack()] } = {}) {
  const calls = [];
  let destroyCalls = 0;
  t.mock.method(Track, "findAll", async (query) => {
    calls.push(["findAll", query]);
    return tracks;
  });
  t.mock.method(Track, "findOne", async (query) => {
    calls.push(["findOne", query]);
    return tracks[0] || null;
  });
  t.mock.method(Track, "create", async (values) => {
    calls.push(["create", values]);
    return { id: 8, ...values };
  });
  t.mock.method(Track, "update", async (values, query) => {
    calls.push(["update", values, query]);
    return [tracks.length ? 1 : 0];
  });
  t.mock.method(Track, "destroy", async (query) => {
    calls.push(["destroy", query]);
    destroyCalls += 1;
    if (query.limit) {
      return destroyCalls === 1 && tracks.length ? tracks.length : 0;
    }
    return tracks.length ? 1 : 0;
  });
  return calls;
}

test("every retained raw Track mutation requires admin authorization before model access", async (t) => {
  const calls = stubTrackModel(t);
  const app = createRouteApp("/api/tracks", trackRoutes);
  const cases = [
    ["put", "/api/tracks/7"],
    ["put", "/api/tracks/7/loser"],
    ["put", "/api/tracks/reset-wrong-pick/7"],
    ["put", "/api/tracks/all-tracks/reset-current-pick"],
    ["delete", "/api/tracks/7"],
    ["put", "/api/tracks/quick-replace/7"],
    ["put", "/api/tracks/add-placeholder/7"],
    ["delete", "/api/tracks/clear-memory/delete-wrong-pick"],
    ["put", "/api/tracks/remove-placeholder/7"],
    ["put", "/api/tracks/update-recent-pick-remove-and-add/7"],
    ["put", "/api/tracks/remove-excess-used-picks/1"],
    ["put", "/api/tracks/remove-last-used-pick/7"],
    ["put", "/api/tracks/add-to-available-picks/7"],
    ["put", "/api/tracks/add-to-used-picks/7"],
    ["put", "/api/tracks/reset-picks/7"],
    ["put", "/api/tracks/reset-to-pick-count/1"],
    ["put", "/api/tracks/fix-current-pick/1"],
    ["put", "/api/tracks/user/3/reset-current-picks"],
    ["put", "/api/tracks/user/3/move-last-used-to-available"],
    ["put", "/api/tracks/reduce-used-picks/7/1"],
    ["put", "/api/tracks/reduce-all-used-picks/1"],
    ["put", "/api/tracks/fix-wrong-pick/1"],
    ["put", "/api/tracks/bug-fix/set-wrong-pick-for-teams"],
    ["put", "/api/tracks/bug-fix/clear-wrong-pick-if-matches/1"],
  ];

  for (const [method, path] of cases) {
    assert.equal((await request(app)[method](path)).status, 401, path);
  }
  assert.deepEqual(calls, []);
});

test("Track access routes preserve list, lifecycle, elimination, and deletion contracts", async (t) => {
  mockLegacyEmergencyPersistence(t);
  const track = createTrack();
  const calls = stubTrackModel(t, { tracks: [track] });
  const app = createRouteApp("/api/tracks", trackRoutes);
  const adminAgent = request.agent(app);
  await adminAgent.post("/api/admin/login").send({ password: "unit-test-admin-password" }).expect(204);

  assert.equal((await adminAgent.get("/api/tracks")).status, 200);
  assert.equal((await adminAgent.get("/api/tracks/alive")).status, 200);
  assert.equal(
    (await adminAgent.get("/api/tracks/wrong-pick-not-null")).status,
    200
  );
  assert.equal(
    (await adminAgent.get("/api/tracks/wrong-pick-not-null/3")).status,
    200
  );
  assert.equal((await request(app).get("/api/tracks/7")).status, 200);
  assert.equal(
    (
      await request(app).post("/api/tracks").send({
        user_id: 3,
        available_picks: ["Broncos"],
        used_picks: [],
        current_pick: null,
      })
    ).status,
    200
  );

  const pick = await adminAgent
    .put("/api/tracks/7")
    .send({ current_pick: "Raiders" });
  assert.equal(pick.status, 200);
  assert.equal(track.current_pick, "Raiders");
  assert.ok(track.used_picks.includes("Raiders"));

  assert.equal(
    (
      await adminAgent
        .put("/api/tracks/7/loser")
        .send({ wrong_pick: "Raiders" })
    ).status,
    200
  );
  assert.equal(
    (await adminAgent.put("/api/tracks/reset-wrong-pick/7")).status,
    200
  );
  assert.equal(
    (await adminAgent.put("/api/tracks/all-tracks/reset-current-pick")).status,
    200
  );
  assert.equal((await adminAgent.delete("/api/tracks/7")).status, 200);
  assert.equal(
    (await adminAgent.get("/api/tracks/user/3/alive")).status,
    200
  );

  assert.ok(calls.some(([name]) => name === "create"));
  assert.ok(calls.some(([name]) => name === "destroy"));
  assert.ok(calls.some(([name, values]) => name === "update" && values.wrong_pick === null));
});

test("Track access routes preserve not-found and safe failure responses", async (t) => {
  mockLegacyEmergencyPersistence(t);
  stubTrackModel(t, { tracks: [] });
  const app = createRouteApp("/api/tracks", trackRoutes);
  const adminAgent = request.agent(app);
  await adminAgent.post("/api/admin/login").send({ password: "unit-test-admin-password" }).expect(204);

  assert.equal((await request(app).get("/api/tracks/999")).status, 404);
  assert.equal(
    (await adminAgent.put("/api/tracks/999").send({ current_pick: "X" }))
      .status,
    404
  );
  assert.equal(
    (
      await adminAgent
        .put("/api/tracks/999/loser")
        .send({ wrong_pick: "X" })
    ).status,
    404
  );
  assert.equal(
    (await adminAgent.put("/api/tracks/reset-wrong-pick/999")).status,
    404
  );
  assert.equal(
    (await adminAgent.put("/api/tracks/all-tracks/reset-current-pick")).status,
    404
  );
  assert.equal((await adminAgent.delete("/api/tracks/999")).status, 404);
  assert.equal(
    (await adminAgent.get("/api/tracks/user/999/alive")).status,
    404
  );
});

test("Pick lifecycle routes preserve every endpoint contract", async (t) => {
  mockLegacyEmergencyPersistence(t);
  const track = createTrack();
  const calls = stubTrackModel(t, { tracks: [track] });
  const app = createRouteApp("/api/tracks", trackRoutes);
  const adminAgent = request.agent(app);
  await adminAgent.post("/api/admin/login").send({ password: "unit-test-admin-password" }).expect(204);

  const requests = [
    () => adminAgent
      .put("/api/tracks/quick-replace/7")
      .send({ teamName: "Raiders" }),
    () => adminAgent.put("/api/tracks/add-placeholder/7"),
    () => adminAgent.delete("/api/tracks/clear-memory/delete-wrong-pick"),
    () => adminAgent.put("/api/tracks/remove-placeholder/7"),
    () => adminAgent.put("/api/tracks/update-recent-pick-remove-and-add/7"),
    () => adminAgent.put("/api/tracks/remove-excess-used-picks/1"),
    () => adminAgent.put("/api/tracks/remove-last-used-pick/7"),
    () => adminAgent
      .put("/api/tracks/add-to-available-picks/7")
      .send({ teamName: "Bills" }),
    () => adminAgent
      .put("/api/tracks/add-to-used-picks/7")
      .send({ teamName: "Bills" }),
    () => adminAgent.put("/api/tracks/reset-picks/7"),
  ];

  for (const send of requests) {
    const response = await send();
    assert.ok(
      [200, 404].includes(response.status),
      `${response.request.method} ${response.request.url} returned ${response.status}`
    );
  }

  const weekResponse = await adminAgent.get(
    "/api/tracks/all-tracks/alive-without-pick"
  );
  assert.equal(weekResponse.status, 400);
  assert.match(weekResponse.body.error, /Invalid calculated week number/);
  assert.ok(calls.some(([name]) => name === "findOne"));
});

test("Pick lifecycle validates required values and missing Tracks", async (t) => {
  mockLegacyEmergencyPersistence(t);
  stubTrackModel(t, { tracks: [] });
  const app = createRouteApp("/api/tracks", trackRoutes);
  const adminAgent = request.agent(app);
  await adminAgent.post("/api/admin/login").send({ password: "unit-test-admin-password" }).expect(204);

  assert.equal(
    (await adminAgent.put("/api/tracks/quick-replace/7").send({})).status,
    400
  );
  assert.equal(
    (
      await adminAgent
        .put("/api/tracks/quick-replace/7")
        .send({ teamName: "Bills" })
    ).status,
    404
  );
  assert.equal(
    (await adminAgent.put("/api/tracks/remove-excess-used-picks/nope")).status,
    400
  );
  assert.equal(
    (
      await adminAgent
        .put("/api/tracks/add-to-available-picks/7")
        .send({})
    ).status,
    400
  );
  assert.equal(
    (
      await adminAgent.put("/api/tracks/add-to-used-picks/7").send({})
    ).status,
    400
  );
});
