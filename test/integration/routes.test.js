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
  const { User, Track, Team, AdminAuditOperation, AdminAuditTarget } = require("../../models/my-index");
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
    await AdminAuditTarget.destroy({ where: {} });
    await AdminAuditOperation.destroy({ where: {} });
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
    const audit = await AdminAuditOperation.findOne({ where: { action: "LEGACY_EMERGENCY_REPAIR" } });
    assert.equal(audit.undoable, false);
    assert.deepEqual(audit.summary, {
      method: "PUT",
      routePattern: "/:id(\\d+)",
      affectedCount: 1,
    });
    const target = await AdminAuditTarget.findOne({ where: { admin_audit_operation_id: audit.id } });
    assert.equal(target.target_type, "TRACK");
    assert.equal(target.target_id, track.body.id);
    assert.equal(target.before_state.currentPick, null);
    assert.equal(target.after_state.currentPick, "Raiders");
  });

  test("raw Track mutation rolls back when its audit cannot commit", async (t) => {
    const user = await User.create({
      first_name: "Rollback",
      last_name: "Target",
      username: "rollback-target",
      email: "rollback@example.test",
      password: "safe-test-password",
    });
    const track = await Track.create({
      user_id: user.id,
      available_picks: ["Broncos", "Raiders"],
      used_picks: [],
      current_pick: null,
    });
    t.mock.method(AdminAuditOperation, "create", async () => {
      throw new Error("simulated audit failure");
    });
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: process.env.ADMIN_PASSWORD }).expect(204);

    const response = await agent.put(`/api/tracks/${track.id}`).send({ current_pick: "Raiders" });

    assert.equal(response.status, 500);
    await track.reload();
    assert.equal(track.current_pick, null);
    assert.deepEqual(track.used_picks, []);
    assert.deepEqual(track.available_picks, ["Broncos", "Raiders"]);
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

}
