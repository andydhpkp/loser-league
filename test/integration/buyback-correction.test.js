const test = require("node:test");
if (!process.env.TEST_DATABASE_URL) {
  test("buyback correction", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  const assert = require("node:assert/strict");
  const { sequelize, User, Team, Track, Pick, LeagueSeason, ScheduleSnapshot, TrackReactivation, BuybackDecision, BuybackDecisionTrack, AdminAuditOperation } = require("../../models");
  const { createPreview, confirmPreview } = require("../../server/admin/action-service");
  const { getLeaguePot } = require("../../server/modules/pot/pot-service");
  const { inspectTrack } = require("../../server/modules/admin-repairs/inspector-service");
  const { migrateEmptyTestDatabase } = require("../support/migrate-test-database");
  const action = "RESTORE_TRACK_ELIMINATION";
  const options = { now: new Date("2026-09-17T00:00:00Z") };
  let season, owner, track, wrong, later, member;
  test.beforeEach(async () => {
    await migrateEmptyTestDatabase(sequelize);
    const free = await User.create({ first_name: "Free", last_name: "Fixture", username: "free", email: "free@example.test", password: "test-password" });
    await sequelize.query("INSERT INTO league_pot_exemption (user_id) VALUES (?)", { replacements: [free.id] });
    owner = await User.create({ first_name: "Paid", last_name: "Fixture", username: "paid", email: "paid@example.test", password: "test-password" });
    season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 2, open_slot: 1 });
    await Team.bulkCreate(["Broncos", "Raiders", "Jets"].map(team_name => ({ team_name, team_record: [0, 0] })));
    await ScheduleSnapshot.create({ league_season_id: season.id, week: 2, provider: "FIXTURE_DOWNLOAD", content_hash: "a".repeat(64), normalized_schedule: { games: [{ homeTeam: "Broncos", awayTeam: "Raiders", kickoff: "2026-09-18T00:00:00Z" }] }, fetched_at: new Date(), created_at: new Date() });
    track = await Track.create({ user_id: owner.id, league_season_id: season.id, available_picks: ["Jets"], used_picks: ["Broncos", "Raiders"], current_pick: "Raiders" });
    wrong = await Pick.create({ track_id: track.id, league_season_id: season.id, week: 1, team_name: "Broncos", origin: "USER_SUBMISSION", outcome: "WRONG_PICK" });
    later = await Pick.create({ track_id: track.id, league_season_id: season.id, week: 2, team_name: "Raiders", origin: "USER_SUBMISSION", outcome: "PENDING" });
    const audit = await AdminAuditOperation.create({ action: "COMPLETE_DIRECT_BUYBACK", description: "Fixture buyback", status: "COMMITTED", league_season_id: season.id, week: 2, summary: {}, undoable: false });
    const reactivation = await TrackReactivation.create({ track_id: track.id, league_season_id: season.id, waived_pick_id: wrong.id, admin_audit_operation_id: audit.id });
    const decision = await BuybackDecision.create({ user_id: owner.id, league_season_id: season.id, status: "COMPLETED_ADMIN_DIRECT", origin: "ADMIN" });
    member = await BuybackDecisionTrack.create({ buyback_decision_id: decision.id, track_id: track.id, week_one_pick_id: wrong.id, resolution: "FULFILLED", track_reactivation_id: reactivation.id });
  });
  test.after(() => sequelize.close());
  const intent = (potTreatment = "REVERSE") => ({ trackId: track.id, pickId: wrong.id, potTreatment, explanation: "Corrected mistaken Track selection" });

  for (const mode of ["REVERSE", "KEEP_TOTAL"]) test(`restores elimination and voids submitted Pick with ${mode} accounting`, async () => {
    const preview = await createPreview(action, intent(mode), options);
    assert.equal(preview.potImpact.before.user.totalCents, 1500);
    assert.equal(preview.potImpact.before.league.totalCents, 1500);
    assert.equal(preview.potImpact.after.user.buybackCount, 0);
    assert.equal(preview.potImpact.after.league.totalCents, mode === "REVERSE" ? 500 : 1500);
    const operation = await confirmPreview(action, preview.confirmationKey, null, options);
    assert.equal(operation.undoable, false);
    await track.reload();
    assert.equal(track.eliminated_by_pick_id, wrong.id);
    assert.equal(track.current_pick, null);
    assert.deepEqual(track.used_picks, ["Broncos"]);
    assert.equal(await Pick.findByPk(later.id), null);
    assert.equal((await Pick.unscoped().findByPk(later.id)).outcome, "PENDING");
    assert.equal(await TrackReactivation.count(), 0);
    assert.ok((await member.reload()).reversed_by_operation_id);
    const history = await inspectTrack(track.id);
    assert.equal(history.picks.find(pick => pick.id === later.id).voided, true);
    const pot = await getLeaguePot();
    assert.equal(pot.buybackCount, 0);
    assert.equal(pot.adjustmentCents, mode === "REVERSE" ? 0 : 1000);
    assert.equal(pot.totalCents, mode === "REVERSE" ? 500 : 1500);
    assert.equal((await confirmPreview(action, preview.confirmationKey, null, options)).id, operation.id);
    assert.equal((await getLeaguePot()).totalCents, pot.totalCents);
    await assert.rejects(createPreview(action, intent(mode), options), /already|corrected|eliminated/);
  });

  test("uncounted exceptional reactivation never invents a pot adjustment", async () => {
    await member.destroy();
    const preview = await createPreview(action, intent("KEEP_TOTAL"), options);
    assert.equal(preview.potImpact.deltaCents, 0);
    await confirmPreview(action, preview.confirmationKey, null, options);
    assert.equal((await getLeaguePot()).totalCents, 500);
    assert.equal((await getLeaguePot()).adjustmentCents, 0);
  });

  test("kickoff closes correction and next week reopens it while preserving settled history", async () => {
    await assert.rejects(createPreview(action, intent(), { now: new Date("2026-09-18T00:00:00Z") }), /kickoff|closed/);
    await later.update({ outcome: "PREDICTION_CORRECT" });
    await season.update({ current_week: 3, state_version: 1 });
    await ScheduleSnapshot.create({ league_season_id: season.id, week: 3, provider: "FIXTURE_DOWNLOAD", content_hash: "b".repeat(64), normalized_schedule: { games: [{ kickoff: "2026-09-25T00:00:00Z" }] }, fetched_at: new Date(), created_at: new Date() });
    const current = await Pick.create({ track_id: track.id, league_season_id: season.id, week: 3, team_name: "Jets", origin: "USER_SUBMISSION", outcome: "PENDING" });
    const nextOptions = { now: new Date("2026-09-24T00:00:00Z") };
    const preview = await createPreview(action, intent(), nextOptions);
    await confirmPreview(action, preview.confirmationKey, null, nextOptions);
    assert.equal((await Pick.unscoped().findByPk(later.id)).outcome, "PREDICTION_CORRECT");
    assert.equal(await Pick.findByPk(current.id), null);
    assert.equal((await Pick.unscoped().findByPk(current.id)).outcome, "PENDING");
  });

  test("changed money or kickoff invalidates confirmation without mutation", async () => {
    const preview = await createPreview(action, intent(), options);
    await Track.create({ user_id: owner.id, league_season_id: season.id, available_picks: ["Jets"] });
    await assert.rejects(confirmPreview(action, preview.confirmationKey, null, options), /stale/);
    const fresh = await createPreview(action, intent(), options);
    await assert.rejects(confirmPreview(action, fresh.confirmationKey, null, { now: new Date("2026-09-18T00:00:00Z") }), /kickoff|closed/);
    assert.ok(await Pick.findByPk(later.id));
    assert.equal((await track.reload()).eliminated_by_pick_id, null);
  });
  test("failed adjustment write rolls back Pick, reactivation, membership, Track and audit", async t => {
    const preview = await createPreview(action, intent("KEEP_TOTAL"), options);
    const beforeAudits = await AdminAuditOperation.count();
    t.mock.method(require("../../models").LeaguePotAdjustment, "create", async () => { throw new Error("injected adjustment failure"); });
    await assert.rejects(confirmPreview(action, preview.confirmationKey, null, options), /injected adjustment failure/);
    assert.equal(await AdminAuditOperation.count(), beforeAudits);
    assert.ok(await Pick.findByPk(later.id));
    assert.equal(await TrackReactivation.count(), 1);
    assert.equal((await member.reload()).reversed_by_operation_id, null);
    assert.equal((await track.reload()).eliminated_by_pick_id, null);
    assert.equal((await getLeaguePot()).totalCents, 1500);
  });

  test("exempt Track reversal does not fabricate a contribution; sibling Tracks stay unchanged", async () => {
    await sequelize.query("UPDATE league_pot_exemption SET user_id = ?", { replacements: [owner.id] });
    const sibling = await Track.create({ user_id: owner.id, league_season_id: season.id, current_pick: "Jets", used_picks: ["Jets"], available_picks: ["Broncos", "Raiders"] });
    const siblingPick = await Pick.create({ track_id: sibling.id, league_season_id: season.id, week: 2, team_name: "Jets", outcome: "PENDING", origin: "USER_SUBMISSION" });
    await assert.rejects(createPreview(action, { ...intent(), pickId: siblingPick.id }, options), /from this Track/);
    const preview = await createPreview(action, intent("KEEP_TOTAL"), options);
    assert.equal(preview.potImpact.before.user.totalCents, 0);
    assert.equal(preview.potImpact.adjustmentCents, 0);
    await confirmPreview(action, preview.confirmationKey, null, options);
    assert.equal((await sibling.reload()).current_pick, "Jets");
    assert.ok(await Pick.findByPk(siblingPick.id));
    assert.equal((await getLeaguePot()).totalCents, 0);
  });

  test("projection rebuild and buyback retry cannot restore void Picks or a reversed buyback", async () => {
    const preview = await createPreview(action, intent(), options);
    const operation = await confirmPreview(action, preview.confirmationKey, null, options);
    await assert.rejects(createPreview("UNDO_ADMIN_ACTION", { operationId: operation.id }, options), /undoable|undo/);
    const { completeAdminDirect, listAdmin } = require("../../server/modules/buyback/buyback-service");
    const retried = await completeAdminDirect({ userId: owner.id, trackIds: [track.id], stateVersion: 0, paymentConfirmed: true, now: options.now });
    assert.equal(retried.idempotent, true);
    assert.equal((await track.reload()).eliminated_by_pick_id, wrong.id);
    const history = await listAdmin({ view: "history" });
    assert.equal(history[0].tracks[0].reversed, true);
    await track.update({ current_pick: "Raiders", used_picks: ["Broncos", "Raiders"], available_picks: ["Jets"], state_version: track.state_version + 1 });
    const rebuild = await createPreview("REBUILD_TRACK_PROJECTIONS", { scope: "SELECTED", trackIds: [track.id] });
    await confirmPreview("REBUILD_TRACK_PROJECTIONS", rebuild.confirmationKey);
    await track.reload();
    assert.equal(track.eliminated_by_pick_id, wrong.id);
    assert.equal(track.current_pick, null);
    assert.deepEqual(track.used_picks, ["Broncos"]);
    assert.equal(await Pick.count({ where: { week: 2 } }), 0);
    await assert.rejects(createPreview("REACTIVATE_TRACK", { trackId: track.id, paymentConfirmed: true, correctionNote: "Attempt to reapply" }), /already reactivated/);
  });

  test("missing schedule, closed season, changed Pick and changed schedule fail safely", async () => {
    const preview = await createPreview(action, intent(), options);
    await later.update({ state_version: 1 });
    await assert.rejects(confirmPreview(action, preview.confirmationKey, null, options), /stale/);
    const fresh = await createPreview(action, intent(), options);
    await ScheduleSnapshot.update({ content_hash: "c".repeat(64) }, { where: { league_season_id: season.id } });
    await assert.rejects(confirmPreview(action, fresh.confirmationKey, null, options), /schedule is stale/);
    await ScheduleSnapshot.destroy({ where: { league_season_id: season.id } });
    await assert.rejects(createPreview(action, intent(), options), /validated/);
    await season.update({ state: "COMPLETE", open_slot: null });
    await assert.rejects(createPreview(action, intent(), options), /active/);
    assert.ok(await Pick.findByPk(later.id));
  });

  test("automatic selection and weekly closure ignore the corrected Track and its void Pick", async () => {
    const preview = await createPreview(action, intent(), options);
    await confirmPreview(action, preview.confirmationKey, null, options);
    const { executeAutoPick } = require("../../server/modules/picks/auto-pick-service");
    const { closeWeek } = require("../../server/modules/week-closure/week-closure-service");
    const kickoff = new Date("2026-09-18T00:00:00Z");
    const schedule = { year: 2026, week: 2, provider: "FIXTURE_DOWNLOAD", contentHash: "a".repeat(64), earliestKickoff: kickoff, teams: ["Broncos", "Raiders"], fetchedAt: options.now, normalizedSchedule: { games: [{ kickoff: kickoff.toISOString(), homeTeam: "Broncos", awayTeam: "Raiders" }] } };
    const result = await executeAutoPick({ schedule, now: kickoff });
    assert.equal(result.assignedCount, 0);
    const closed = await closeWeek({ leagueSeasonId: season.id, week: 2, scheduleHash: schedule.contentHash, mode: "AUTOMATIC", games: [{ homeTeam: "Broncos", awayTeam: "Raiders", status: "FINAL", winnerTeam: "Broncos", loserTeam: "Raiders", tied: false }] });
    assert.equal(closed.status, "COMPLETED");
    assert.equal((await season.reload()).current_week, 3);
    assert.equal((await track.reload()).eliminated_by_pick_id, wrong.id);
    assert.equal((await Pick.unscoped().findByPk(later.id)).outcome, "PENDING");
    assert.equal(await Pick.count({ where: { week: 2 } }), 0);
  });

  test("ownership changes invalidate an exceptional correction even when monetary totals match", async () => {
    await member.destroy();
    const preview = await createPreview(action, intent(), options);
    const other = await User.create({ first_name: "Other", last_name: "Fixture", username: "other", email: "other@example.test", password: "test-password" });
    await track.update({ user_id: other.id });
    await assert.rejects(confirmPreview(action, preview.confirmationKey, null, options), /stale/);
    assert.ok(await Pick.findByPk(later.id));
  });

}
