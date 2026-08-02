const test = require("node:test");
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("guided admin repairs", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  const assert = require("node:assert/strict");
  const {
    sequelize, User, Team, Track, Pick, LeagueSeason, ScheduleSnapshot,
    TrackReactivation, AdminAuditOperation, AdminAuditTarget,
  } = require("../../models");
  const { createPreview, confirmPreview } = require("../../server/admin/action-service");
  const { inspectTrack } = require("../../server/modules/admin-repairs/inspector-service");
  const { migrateEmptyTestDatabase } = require("../support/migrate-test-database");

  test.beforeEach(async () => migrateEmptyTestDatabase(sequelize));
  test.after(async () => sequelize.close());

  async function currentTrack({ week = 3 } = {}) {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: week, pick_cycle: 1, state_version: 1, open_slot: 1 });
    const user = await User.create({ first_name: "Repair", last_name: "Target", username: `repair-${week}`, email: `repair-${week}@example.test`, password: "safe-test-password" });
    await Team.bulkCreate(["Broncos", "Raiders", "Chiefs", "Chargers"].map((team_name) => ({ team_name, team_record: [0, 0] })));
    const track = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Chargers"], used_picks: ["Raiders", "Chiefs", "Broncos"], current_pick: "Broncos", wrong_pick: null, state_version: 2 });
    const scheduleHash = "e".repeat(64);
    await ScheduleSnapshot.create({ league_season_id: season.id, week, provider: "FIXTURE_DOWNLOAD", content_hash: scheduleHash, normalized_schedule: { week, games: [{ kickoff: "2026-09-20T17:00:00.000Z", homeTeam: "Broncos", awayTeam: "Chargers" }] }, fetched_at: new Date(), created_at: new Date() });
    const pick = await Pick.create({ track_id: track.id, league_season_id: season.id, week, pick_cycle: 1, team_name: "Broncos", origin: "USER_SUBMISSION", outcome: "PENDING", committed_at: new Date(), schedule_hash: scheduleHash, state_version: 0 });
    return { season, user, track, pick, scheduleHash };
  }

  test("selected current-week reset deletes only its pending Pick and commits undoable actorless audit", async () => {
    const { track, pick } = await currentTrack();
    const preview = await createPreview("RESET_CURRENT_PICKS", { scope: "SELECTED", trackIds: [track.id] });

    assert.deepEqual(preview.affectedIds, [
      { targetType: "TRACK", targetId: track.id },
      { targetType: "PICK", targetId: pick.id },
    ]);
    const operation = await confirmPreview("RESET_CURRENT_PICKS", preview.confirmationKey, "Wrong browser submission");

    await track.reload();
    assert.equal(await Pick.count(), 0);
    assert.equal(track.current_pick, null);
    assert.deepEqual(track.used_picks, ["Raiders", "Chiefs"]);
    assert.deepEqual(track.available_picks, ["Chargers", "Broncos"]);
    assert.equal(track.state_version, 3);
    assert.equal(operation.action, "RESET_CURRENT_PICKS");
    assert.equal(operation.undoable, true);
    assert.equal(operation.note, "Wrong browser submission");
    assert.equal(JSON.stringify(operation.toJSON()).includes("actor"), false);
    assert.equal(await AdminAuditOperation.count(), 1);
    assert.equal(await AdminAuditTarget.count(), 2);
    const inspection = await inspectTrack(track.id);
    assert.equal(inspection.recentOperations[0].action, "RESET_CURRENT_PICKS");
    assert.equal(inspection.recentOperations[0].undoable, true);
  });

  test("all-active current-week reset requires the exact high-impact confirmation phrase", async () => {
    const { season, user, track, scheduleHash } = await currentTrack();
    const other = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Broncos"], used_picks: ["Raiders", "Chiefs", "Chargers"], current_pick: "Chargers", wrong_pick: null, state_version: 0 });
    await Pick.create({ track_id: other.id, league_season_id: season.id, week: 3, pick_cycle: 1, team_name: "Chargers", origin: "AUTOMATIC_SELECTION", outcome: "PENDING", committed_at: new Date(), schedule_hash: scheduleHash, state_version: 0 });
    const preview = await createPreview("RESET_CURRENT_PICKS", { scope: "ALL" });

    await assert.rejects(confirmPreview("RESET_CURRENT_PICKS", preview.confirmationKey, null, { confirmationPhrase: "reset" }), /RESET EVERY TRACK/);
    assert.equal(await Pick.count(), 2);
    await confirmPreview("RESET_CURRENT_PICKS", preview.confirmationKey, null, { confirmationPhrase: "RESET EVERY TRACK" });

    assert.equal(await Pick.count(), 0);
    assert.equal((await Track.findByPk(track.id)).current_pick, null);
    assert.equal((await Track.findByPk(other.id)).current_pick, null);
    assert.equal(await AdminAuditOperation.count({ where: { action: "RESET_CURRENT_PICKS" } }), 1);
  });

  test("all-active reset fails atomically when any active Track lacks a pending Pick", async () => {
    const { season, user } = await currentTrack();
    await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Broncos"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 });

    await assert.rejects(createPreview("RESET_CURRENT_PICKS", { scope: "ALL" }), /Every active Track must have a pending current-week Pick/);
    assert.equal(await Pick.count(), 1);
  });

  test("admin assignment fills one missing current Pick from the validated schedule", async () => {
    const { track, pick } = await currentTrack();
    await pick.destroy();
    await track.update({ current_pick: null, used_picks: ["Raiders", "Chiefs"], available_picks: ["Broncos", "Chargers"], state_version: 3 });

    const preview = await createPreview("ASSIGN_CURRENT_PICK", { trackId: track.id, teamName: "Chargers" });
    const operation = await confirmPreview("ASSIGN_CURRENT_PICK", preview.confirmationKey, "Restore missing submission");

    const assigned = await Pick.findOne({ where: { track_id: track.id, week: 3 } });
    await track.reload();
    assert.equal(assigned.team_name, "Chargers");
    assert.equal(assigned.origin, "SHARED_ADMIN_REPAIR");
    assert.equal(assigned.pick_cycle, 1);
    assert.equal(track.current_pick, "Chargers");
    assert.deepEqual(track.used_picks, ["Raiders", "Chiefs", "Chargers"]);
    assert.deepEqual(track.available_picks, ["Broncos"]);
    assert.equal(operation.undoable, true);
    assert.equal(operation.targets.some((target) => target.target_type === "PICK" && target.target_id === assigned.id), true);
  });

  test("admin replacement updates one pending Pick without adding history", async () => {
    const { track, pick } = await currentTrack();
    const preview = await createPreview("REPLACE_CURRENT_PICK", { trackId: track.id, teamName: "Chargers" });
    const operation = await confirmPreview("REPLACE_CURRENT_PICK", preview.confirmationKey);

    await Promise.all([track.reload(), pick.reload()]);
    assert.equal(await Pick.count(), 1);
    assert.equal(pick.team_name, "Chargers");
    assert.equal(pick.origin, "SHARED_ADMIN_REPAIR");
    assert.equal(pick.state_version, 1);
    assert.equal(track.current_pick, "Chargers");
    assert.deepEqual(track.used_picks, ["Raiders", "Chiefs", "Chargers"]);
    assert.deepEqual(track.available_picks, ["Broncos"]);
    assert.equal(operation.undoable, true);
  });

  test("buyback reactivates the same Track while preserving its factual Wrong Pick", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 2, pick_cycle: 1, state_version: 1, open_slot: 1 });
    const user = await User.create({ first_name: "Buy", last_name: "Back", username: "buyback", email: "buyback@example.test", password: "safe-test-password" });
    const track = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Chiefs"], used_picks: ["Broncos"], current_pick: null, wrong_pick: "Broncos", state_version: 4 });
    const pick = await Pick.create({ track_id: track.id, league_season_id: season.id, week: 1, pick_cycle: 1, team_name: "Broncos", origin: "USER_SUBMISSION", outcome: "WRONG_PICK", committed_at: new Date(), schedule_hash: "a".repeat(64), state_version: 1 });
    await track.update({ eliminated_by_pick_id: pick.id });

    const preview = await createPreview("REACTIVATE_TRACK", { trackId: track.id, paymentConfirmed: true });
    const operation = await confirmPreview("REACTIVATE_TRACK", preview.confirmationKey);
    const repeated = await confirmPreview("REACTIVATE_TRACK", preview.confirmationKey);

    await Promise.all([track.reload(), pick.reload()]);
    const reactivation = await TrackReactivation.findOne();
    assert.equal(track.eliminated_by_pick_id, null);
    assert.equal(track.wrong_pick, null);
    assert.deepEqual(track.used_picks, ["Broncos"]);
    assert.deepEqual(track.available_picks, ["Chiefs"]);
    assert.equal(pick.outcome, "WRONG_PICK");
    assert.equal(reactivation.waived_pick_id, pick.id);
    assert.equal(reactivation.admin_audit_operation_id, operation.id);
    assert.equal(operation.undoable, true);
    assert.equal(repeated.id, operation.id);
    assert.equal(await TrackReactivation.count(), 1);
  });

  test("manual Week 19 playoff reset advances every Track to cycle 2 exactly once", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 19, pick_cycle: 1, state_version: 8, open_slot: 1 });
    const user = await User.create({ first_name: "Playoff", last_name: "Reset", username: "playoff-reset", email: "playoff-reset@example.test", password: "safe-test-password" });
    await Team.bulkCreate(["Broncos", "Raiders", "Chiefs"].map((team_name) => ({ team_name, team_record: [0, 0] })));
    const active = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Chiefs"], used_picks: ["Broncos", "Raiders"], current_pick: null, wrong_pick: null, state_version: 2 });
    const eliminated = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Raiders"], used_picks: ["Chiefs", "Broncos"], current_pick: null, wrong_pick: "Broncos", state_version: 3 });
    const eliminatingPick = await Pick.create({ track_id: eliminated.id, league_season_id: season.id, week: 10, pick_cycle: 1, team_name: "Broncos", origin: "USER_SUBMISSION", outcome: "WRONG_PICK", committed_at: new Date(), schedule_hash: "b".repeat(64), state_version: 0 });
    await eliminated.update({ eliminated_by_pick_id: eliminatingPick.id });

    const preview = await createPreview("RESET_PLAYOFF_PICK_POOLS", {});
    await assert.rejects(confirmPreview("RESET_PLAYOFF_PICK_POOLS", preview.confirmationKey, null, { confirmationPhrase: "RESET" }), /RESET PICKS FOR PLAYOFFS/);
    const operation = await confirmPreview("RESET_PLAYOFF_PICK_POOLS", preview.confirmationKey, null, { confirmationPhrase: "RESET PICKS FOR PLAYOFFS" });

    await Promise.all([season.reload(), active.reload(), eliminated.reload()]);
    assert.equal(season.pick_cycle, 2);
    assert.equal(season.state_version, 9);
    for (const track of [active, eliminated]) {
      assert.deepEqual(track.used_picks, []);
      assert.deepEqual(track.available_picks, ["Broncos", "Raiders", "Chiefs"]);
    }
    assert.equal(eliminated.eliminated_by_pick_id, eliminatingPick.id);
    assert.equal(eliminated.wrong_pick, "Broncos");
    assert.equal(operation.undoable, false);
    assert.equal(await AdminAuditOperation.count({ where: { action: "RESET_PLAYOFF_PICK_POOLS" } }), 1);
    await assert.rejects(createPreview("RESET_PLAYOFF_PICK_POOLS", {}), /cycle 1/i);
  });

  test("Track inspector returns normalized league state and excludes sensitive User data", async () => {
    const { track, user, pick } = await currentTrack();
    const result = await inspectTrack(track.id);

    assert.deepEqual(result.user, { id: user.id, displayName: "Repair Target", username: "repair-3" });
    assert.equal(result.track.id, track.id);
    assert.equal(result.leagueSeason.week, 3);
    assert.equal(result.leagueSeason.pickCycle, 1);
    assert.deepEqual(result.picks.map((item) => ({ id: item.id, week: item.week, teamName: item.teamName, outcome: item.outcome })), [
      { id: pick.id, week: 3, teamName: "Broncos", outcome: "PENDING" },
    ]);
    assert.equal(result.projections.currentPick, "Broncos");
    assert.equal(result.eligibleCurrentWeekTeams.includes("Chargers"), true);
    assert.equal(JSON.stringify(result).includes("@example.test"), false);
    assert.equal(Object.hasOwn(result.user, "email"), false);
  });
}
