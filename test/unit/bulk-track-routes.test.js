const assert = require("node:assert/strict");
const test = require("node:test");
const request = require("supertest");
const { createBulkTrackRouter } = require("../../server/admin/bulk-track-routes");
const { createRouteApp } = require("../support/route-app");

test("bulk Track creation authorizes before forwarding the selected quantities", async () => {
  const calls = [];
  const router = createBulkTrackRouter({ createTracks: async (additions) => {
    calls.push(additions);
    return { totalCreated: 4, additions };
  } });
  const app = createRouteApp("/test-admin-tracks-bulk", router);
  assert.equal((await request(app).post("/test-admin-tracks-bulk").send({ additions: [{ userId: 3, quantity: 4 }] })).status, 401);
  assert.deepEqual(calls, []);

  const agent = request.agent(app);
  await agent.post("/api/admin/login").send({ password: "unit-test-admin-password" }).expect(204);
  const response = await agent.post("/test-admin-tracks-bulk").send({ additions: [{ userId: 3, quantity: 4 }] });
  assert.equal(response.status, 201);
  assert.deepEqual(calls, [[{ userId: 3, quantity: 4 }]]);
  assert.equal(response.body.totalCreated, 4);
});
