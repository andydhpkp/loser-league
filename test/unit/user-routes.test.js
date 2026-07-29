const assert = require("node:assert/strict");
const { test } = require("node:test");
const request = require("supertest");

const { User, Track } = require("../../models/my-index");
const userRoutes = require("../../controllers/api/user-routes");
const { createRouteApp } = require("../support/route-app");

test("User routes preserve successful CRUD, authentication, and win contracts", async (t) => {
  const app = createRouteApp("/api/users", userRoutes);
  const agent = request.agent(app);
  const calls = [];
  const user = {
    id: 3,
    username: "alice",
    password: "hash",
    user_record: [],
    checkPassword: () => true,
    changed: (...args) => calls.push(["changed", ...args]),
    async save() {
      calls.push(["save"]);
      return this;
    },
    getTotalWins: () => 1,
    getCleanWins: () => 1,
    getWinsWithTies: () => 0,
  };
  let found = user;

  t.mock.method(User, "findAll", async (query) => {
    calls.push(["findAll", query]);
    return [user];
  });
  t.mock.method(User, "findOne", async (query) => {
    calls.push(["findOne", query]);
    return found;
  });
  t.mock.method(User, "findByPk", async (id) => {
    calls.push(["findByPk", id]);
    return found;
  });
  t.mock.method(User, "create", async (values) => {
    calls.push(["create", values]);
    return user;
  });
  t.mock.method(User, "update", async (values, query) => {
    calls.push(["update", values, query]);
    return [1];
  });
  t.mock.method(User, "destroy", async (query) => {
    calls.push(["destroy", query]);
    return 1;
  });

  assert.equal((await agent.get("/api/users")).status, 200);
  assert.equal((await agent.get("/api/users/3")).status, 200);
  assert.equal((await agent.get("/api/users/username/alice")).status, 200);

  const registration = await agent.post("/api/users").send({
    first_name: "Alice",
    last_name: "Able",
    username: "alice",
    email: "alice@example.test",
    password: "secret",
  });
  assert.equal(registration.status, 200);
  assert.deepEqual(calls.find(([name]) => name === "create")[1], {
    first_name: "Alice",
    last_name: "Able",
    username: "alice",
    email: "alice@example.test",
    password: "secret",
  });

  const login = await agent
    .post("/api/users/login")
    .send({ username: "alice", password: "secret", staySignedIn: true });
  assert.equal(login.status, 200);
  assert.equal(login.body.message, "You are now logged in!");
  assert.equal((await agent.get("/api/users/logged")).status, 200);

  assert.equal(
    (await agent.put("/api/users/3").send({ first_name: "Alicia" })).status,
    200
  );
  assert.equal((await agent.delete("/api/users/3")).status, 200);
  assert.equal((await agent.delete("/api/users/username/alice")).status, 200);

  const reset = await agent.post("/api/users/reset-password").send({
    email: "alice@example.test",
    newPassword: "new-secret",
    newUsername: "alicia",
  });
  assert.equal(reset.status, 200);
  assert.equal(user.username, "alicia");
  assert.notEqual(user.password, "new-secret");

  const addWin = await agent
    .put("/api/users/3/add-win")
    .send({ year: 2026, won_with_tie: false });
  assert.equal(addWin.status, 200);
  assert.equal(addWin.body.total_wins, 1);
  assert.deepEqual(user.user_record, [
    { year: 2026, won: true, won_with_tie: false },
  ]);

  const wins = await agent.get("/api/users/3/wins");
  assert.equal(wins.status, 200);
  assert.equal(wins.body.username, "alicia");

  assert.equal((await agent.post("/api/users/logout")).status, 204);
  assert.equal((await agent.post("/api/users/logout")).status, 404);
  assert.ok(calls.some(([name, query]) => name === "findAll" && query.include));
  assert.ok(
    calls.some(
      ([name, query]) =>
        name === "findOne" && query.include?.[0]?.model === Track
    )
  );
});

test("User routes characterize validation, authentication, and not-found responses", async (t) => {
  const app = createRouteApp("/api/users", userRoutes);
  let found = null;
  t.mock.method(User, "findOne", async () => found);
  t.mock.method(User, "findByPk", async () => found);
  t.mock.method(User, "update", async () => null);
  t.mock.method(User, "destroy", async () => 0);

  assert.equal((await request(app).get("/api/users/999")).status, 404);
  assert.equal(
    (await request(app).get("/api/users/username/missing")).status,
    404
  );
  assert.equal(
    (
      await request(app)
        .post("/api/users/login")
        .send({ username: "missing", password: "x" })
    ).status,
    400
  );

  found = { checkPassword: () => false };
  assert.equal(
    (
      await request(app)
        .post("/api/users/login")
        .send({ username: "alice", password: "wrong" })
    ).status,
    400
  );

  found = null;
  assert.equal((await request(app).get("/api/users/logged")).status, 400);
  assert.equal((await request(app).put("/api/users/999").send({})).status, 404);
  assert.equal((await request(app).delete("/api/users/999")).status, 404);
  assert.equal(
    (await request(app).delete("/api/users/username/missing")).status,
    404
  );
  assert.equal(
    (
      await request(app)
        .post("/api/users/reset-password")
        .send({ email: "missing@example.test", newPassword: "x" })
    ).status,
    404
  );
  assert.equal(
    (await request(app).put("/api/users/3/add-win").send({})).status,
    400
  );
  assert.equal((await request(app).get("/api/users/999/wins")).status, 404);
});

test("User add-win missing-user response terminates with one 404", async (t) => {
  const app = createRouteApp("/api/users", userRoutes);
  t.mock.method(User, "findByPk", async () => null);

  const response = await request(app)
    .put("/api/users/999/add-win")
    .send({ year: 2026 });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: "No user found with this id" });
});

test("User routes map model failures to safe errors", async (t) => {
  const app = createRouteApp("/api/users", userRoutes);
  t.mock.method(User, "findAll", async () => {
    throw new Error("database secret");
  });
  const response = await request(app).get("/api/users");
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  });
});
