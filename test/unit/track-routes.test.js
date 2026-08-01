const assert = require("node:assert/strict");
const { test } = require("node:test");
const request = require("supertest");

const { Track } = require("../../models/my-index");
const trackRoutes = require("../../controllers/api/tracks");
const { createRouteApp, createTrack } = require("../support/route-app");

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

test("Track access routes preserve list, lifecycle, elimination, and deletion contracts", async (t) => {
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
      await request(app)
        .put("/api/tracks/7/loser")
        .send({ wrong_pick: "Raiders" })
    ).status,
    200
  );
  assert.equal(
    (await request(app).put("/api/tracks/reset-wrong-pick/7")).status,
    200
  );
  assert.equal(
    (await request(app).put("/api/tracks/all-tracks/reset-current-pick")).status,
    200
  );
  assert.equal((await request(app).delete("/api/tracks/7")).status, 200);
  assert.equal(
    (await adminAgent.get("/api/tracks/user/3/alive")).status,
    200
  );

  assert.ok(calls.some(([name]) => name === "create"));
  assert.ok(calls.some(([name]) => name === "destroy"));
  assert.ok(calls.some(([name, values]) => name === "update" && values.wrong_pick === null));
});

test("Track access routes preserve not-found and safe failure responses", async (t) => {
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
      await request(app)
        .put("/api/tracks/999/loser")
        .send({ wrong_pick: "X" })
    ).status,
    404
  );
  assert.equal(
    (await request(app).put("/api/tracks/reset-wrong-pick/999")).status,
    404
  );
  assert.equal(
    (await request(app).put("/api/tracks/all-tracks/reset-current-pick")).status,
    404
  );
  assert.equal((await request(app).delete("/api/tracks/999")).status, 404);
  assert.equal(
    (await adminAgent.get("/api/tracks/user/999/alive")).status,
    404
  );
});

test("Pick lifecycle routes preserve every endpoint contract", async (t) => {
  const track = createTrack();
  const calls = stubTrackModel(t, { tracks: [track] });
  const app = createRouteApp("/api/tracks", trackRoutes);

  const requests = [
    request(app)
      .put("/api/tracks/quick-replace/7")
      .send({ teamName: "Raiders" }),
    request(app).put("/api/tracks/add-placeholder/7"),
    request(app).delete("/api/tracks/clear-memory/delete-wrong-pick"),
    request(app).put("/api/tracks/remove-placeholder/7"),
    request(app).put("/api/tracks/update-recent-pick-remove-and-add/7"),
    request(app).put("/api/tracks/remove-excess-used-picks/1"),
    request(app).put("/api/tracks/remove-last-used-pick/7"),
    request(app)
      .put("/api/tracks/add-to-available-picks/7")
      .send({ teamName: "Bills" }),
    request(app)
      .put("/api/tracks/add-to-used-picks/7")
      .send({ teamName: "Bills" }),
    request(app).put("/api/tracks/reset-picks/7"),
  ];

  for (const pending of requests) {
    const response = await pending;
    assert.ok(
      [200, 404].includes(response.status),
      `${response.request.method} ${response.request.url} returned ${response.status}`
    );
  }

  const weekResponse = await request(app).get(
    "/api/tracks/all-tracks/alive-without-pick"
  );
  assert.equal(weekResponse.status, 400);
  assert.match(weekResponse.body.error, /Invalid calculated week number/);
  assert.ok(calls.some(([name]) => name === "findOne"));
});

test("Pick lifecycle validates required values and missing Tracks", async (t) => {
  stubTrackModel(t, { tracks: [] });
  const app = createRouteApp("/api/tracks", trackRoutes);

  assert.equal(
    (await request(app).put("/api/tracks/quick-replace/7").send({})).status,
    400
  );
  assert.equal(
    (
      await request(app)
        .put("/api/tracks/quick-replace/7")
        .send({ teamName: "Bills" })
    ).status,
    404
  );
  assert.equal(
    (await request(app).put("/api/tracks/remove-excess-used-picks/nope")).status,
    400
  );
  assert.equal(
    (
      await request(app)
        .put("/api/tracks/add-to-available-picks/7")
        .send({})
    ).status,
    400
  );
  assert.equal(
    (
      await request(app).put("/api/tracks/add-to-used-picks/7").send({})
    ).status,
    400
  );
});
