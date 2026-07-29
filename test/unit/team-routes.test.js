const assert = require("node:assert/strict");
const { test } = require("node:test");
const request = require("supertest");

const { Team } = require("../../models/my-index");
const teamRoutes = require("../../controllers/api/team-routes");
const { createRouteApp } = require("../support/route-app");

test("Team routes preserve every successful endpoint contract", async (t) => {
  const app = createRouteApp("/api/teams", teamRoutes);
  const team = { id: 7, team_name: "Broncos", team_record: ["1", "0"] };
  const calls = [];

  t.mock.method(Team, "findAll", async (query) => {
    calls.push(["findAll", query]);
    return [team];
  });
  t.mock.method(Team, "findOne", async (query) => {
    calls.push(["findOne", query]);
    return team;
  });
  t.mock.method(Team, "create", async (values) => {
    calls.push(["create", values]);
    return team;
  });
  t.mock.method(Team, "update", async (values, query) => {
    calls.push(["update", values, query]);
    return [1];
  });
  t.mock.method(Team, "destroy", async (query) => {
    calls.push(["destroy", query]);
    return 1;
  });

  assert.equal((await request(app).get("/api/teams")).status, 200);
  assert.equal((await request(app).get("/api/teams/7")).status, 200);
  assert.equal(
    (await request(app).get("/api/teams/team/Broncos")).status,
    200
  );
  assert.equal(
    (
      await request(app).post("/api/teams").send({
        team_name: "Broncos",
        team_logo: "logo",
        team_record: ["1", "0"],
      })
    ).status,
    200
  );
  assert.equal(
    (await request(app).put("/api/teams/7").send({ team_record: ["2", "0"] }))
      .status,
    200
  );
  assert.equal(
    (
      await request(app)
        .put("/api/teams/team/Broncos")
        .send({ team_record: ["2", "0"] })
    ).status,
    200
  );
  assert.equal((await request(app).delete("/api/teams/7")).status, 200);
  assert.equal((await request(app).delete("/api/teams")).status, 200);
  assert.deepEqual(
    (await request(app).put("/api/teams/reset-records")).body,
    { message: "All team records reset to 0-0" }
  );
  assert.ok(
    calls.some(
      ([name, values, query]) =>
        name === "update" &&
        Array.isArray(values.team_record) &&
        values.team_record[0] === 0 &&
        values.team_record[1] === 0 &&
        Object.keys(query.where).length === 0
    )
  );
});

test("Team routes preserve not-found and safe failure contracts", async (t) => {
  const app = createRouteApp("/api/teams", teamRoutes);
  t.mock.method(Team, "findOne", async () => null);
  t.mock.method(Team, "update", async () => null);
  t.mock.method(Team, "destroy", async () => 0);

  assert.equal((await request(app).get("/api/teams/999")).status, 404);
  assert.equal(
    (await request(app).get("/api/teams/team/Missing")).status,
    404
  );
  assert.equal((await request(app).put("/api/teams/999")).status, 404);
  assert.equal(
    (await request(app).put("/api/teams/team/Missing")).status,
    404
  );
  assert.equal((await request(app).delete("/api/teams/999")).status, 404);
  assert.equal((await request(app).delete("/api/teams")).status, 404);
  assert.equal((await request(app).put("/api/teams/reset-records")).status, 404);
});

test("Team list failures return a safe error", async (t) => {
  const app = createRouteApp("/api/teams", teamRoutes);
  t.mock.method(Team, "findAll", async () => {
    throw new Error("database detail");
  });
  const response = await request(app).get("/api/teams");
  assert.equal(response.status, 500);
  assert.equal(response.body.error, "INTERNAL_ERROR");
});
