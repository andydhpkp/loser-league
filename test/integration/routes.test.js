const test = require("node:test");

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("MySQL route characterization", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET ||= "integration-session-secret";
  process.env.ADMIN_PASSWORD ||= "integration-admin-password";

  const assert = require("node:assert/strict");
  const request = require("supertest");
  const sequelize = require("../../config/connection");
  const { User, Track, Team } = require("../../models/my-index");
  const { createApp } = require("../../server/app");
  const {
    migrateEmptyTestDatabase,
  } = require("../support/migrate-test-database");

  test.before(async () => {
    await migrateEmptyTestDatabase(sequelize);
  });

  test.after(async () => {
    await sequelize.close();
  });

  test.beforeEach(async () => {
    await Track.destroy({ where: {} });
    await User.destroy({ where: {} });
    await Team.destroy({ where: {} });
  });

  test("registration, track creation, and pick mutation preserve their route contracts", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const registration = await agent.post("/api/users").send({
      first_name: "Test",
      last_name: "Player",
      username: "test-player",
      email: "player@example.test",
      password: "safe-test-password",
    });
    assert.equal(registration.status, 200);

    const track = await agent.post("/api/tracks").send({
      user_id: registration.body.id,
      available_picks: ["Broncos", "Raiders"],
      used_picks: [],
      current_pick: null,
    });
    assert.equal(track.status, 200);

    const adminAgent = request.agent(app);
    await adminAgent.post("/api/admin/login").send({ password: process.env.ADMIN_PASSWORD }).expect(204);
    const pick = await adminAgent
      .put(`/api/tracks/${track.body.id}`)
      .send({ current_pick: "Raiders" });
    assert.equal(pick.status, 200);
    assert.equal(pick.body.current_pick, "Raiders");
    assert.deepEqual(pick.body.available_picks, ["Broncos"]);
    assert.deepEqual(pick.body.used_picks, ["Raiders"]);
  });

  test("named team maintenance route is not shadowed by the ID route", async () => {
    await Team.create({
      team_name: "Denver Broncos",
      team_record: [1, 2],
    });

    const response = await request(createApp())
      .put("/api/teams/reset-records")
      .send({});

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      message: "All team records reset to 0-0",
    });
  });

  test("failed force-pick commits do not activate cooldowns", async () => {
    const user = await User.create({
      first_name: "Force",
      last_name: "Pick",
      username: "force-pick",
      email: "force-pick@example.test",
      password: "safe-test-password",
    });
    await Track.create({
      user_id: user.id,
      available_picks: ["Broncos", "Raiders"],
      used_picks: [],
      current_pick: null,
    });

    const originalTransaction = sequelize.transaction;
    sequelize.transaction = async (...args) => {
      const transaction = await originalTransaction.call(sequelize, ...args);
      transaction.commit = async () => {
        await transaction.rollback();
        throw new Error("forced commit failure");
      };
      return transaction;
    };

    try {
      const failed = await request(createApp()).put(
        "/api/tracks/force-picks/all-alive"
      );
      assert.equal(failed.status, 500);
    } finally {
      sequelize.transaction = originalTransaction;
    }

    const retry = await request(createApp()).put(
      "/api/tracks/force-picks/all-alive"
    );
    assert.equal(retry.status, 200);
    assert.equal(retry.body.successCount, 1);
  });
}
