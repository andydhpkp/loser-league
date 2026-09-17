const test = require("node:test");
const assert = require("node:assert/strict");
const models = require("../../models");
const { correctionWindow, buildEliminationCorrection, commitEliminationCorrection } = require("../../server/modules/admin-repairs/elimination-correction");
const { getLeaguePot } = require("../../server/modules/pot/pot-service");
const transaction = { LOCK: { UPDATE: "UPDATE" } };
const now = new Date("2026-09-17T00:00:00Z");
const intent = { trackId: 1, pickId: 11, potTreatment: "REVERSE", explanation: "Mistaken buyback" };
const instance = values => ({ ...values, async update(next) { Object.assign(this, next); } });
function fixtures(t) {
  const season = instance({ id: 3, state: "ACTIVE", current_week: 2, pick_cycle: 1, schedule_phase: "REGULAR", year: 2026 });
  const schedule = { content_hash: "a".repeat(64), normalized_schedule: { games: [{ kickoff: "2026-09-18T00:00:00Z" }] } };
  const track = instance({ id: 1, user_id: 2, league_season_id: 3, current_pick: "Raiders", used_picks: ["Broncos", "Raiders"], available_picks: ["Jets"], wrong_pick: null, eliminated_by_pick_id: null, state_version: 1 });
  const picks = [instance({ id: 11, week: 1, pick_cycle: 1, team_name: "Broncos", outcome: "WRONG_PICK", state_version: 0 }), instance({ id: 12, week: 2, pick_cycle: 1, team_name: "Raiders", outcome: "PENDING", state_version: 0 })];
  const events = [instance({ id: 21, waived_pick_id: 11 })];
  const members = [instance({ id: 31, track_reactivation_id: 21, buyback_decision_id: 41, resolution: "FULFILLED" })];
  const decisions = [instance({ id: 41, user_id: 2, league_season_id: 3, status: "COMPLETED_ADMIN_DIRECT", state_version: 0 })];
  t.mock.method(models.LeagueSeason, "findOne", async () => season);
  t.mock.method(models.ScheduleSnapshot, "findOne", async () => schedule);
  t.mock.method(models.Track, "findByPk", async () => track);
  t.mock.method(models.Pick, "findAll", async () => picks);
  t.mock.method(models.TrackReactivation, "findAll", async () => events);
  t.mock.method(models.BuybackDecisionTrack, "findAll", async () => members);
  t.mock.method(models.BuybackDecision, "findAll", async () => decisions);
  t.mock.method(models.Team, "findAll", async () => ["Broncos", "Raiders", "Jets"].map(team_name => ({ team_name })));
  const money = { trackCount: 1, buybackCount: 1, adjustmentCents: 0 };
  t.mock.method(models.sequelize, "query", async sql => sql.startsWith("SELECT user_id") ? [{ user_id: 999 }] : [money]);
  const adjustments = [];
  t.mock.method(models.LeaguePotAdjustment, "create", async values => adjustments.push(values));
  return { season, schedule, track, picks, events, members, decisions, money, adjustments };
}

test("correction window fails closed and uses exact earliest kickoff", () => {
  const season = { state: "ACTIVE" };
  assert.match(correctionWindow(null, null), /active/);
  assert.match(correctionWindow({ ...season, preseason_complete: true }, null), /active/);
  for (const games of [undefined, [], [{ kickoff: null }], [{ kickoff: "invalid" }]]) assert.match(correctionWindow(season, { normalized_schedule: { games } }, now), /validated/);
  const schedule = { normalized_schedule: { games: [{ kickoff: "2026-09-18T00:00:00Z" }, { kickoff: "2026-09-17T00:00:00Z" }] } };
  assert.match(correctionWindow(season, schedule, now), /kickoff/);
  assert.equal(correctionWindow(season, schedule, new Date("2026-09-16T23:59:59Z")), null);
});

for (const potTreatment of ["REVERSE", "KEEP_TOTAL"]) test(`correction commits normalized history and ${potTreatment} money`, async t => {
  const data = fixtures(t);
  const built = await buildEliminationCorrection({ ...intent, potTreatment }, transaction, true, { now: () => now });
  assert.equal(built.targets.filter(target => target.afterState.voided).length, 1);
  assert.equal(built.potImpact.after.user.totalCents, potTreatment === "REVERSE" ? 500 : 1500);
  await commitEliminationCorrection(built, { id: 100 }, transaction);
  assert.equal(data.track.eliminated_by_pick_id, 11);
  assert.equal(data.picks[1].voided_by_operation_id, 100);
  assert.equal(data.events[0].reversed_by_operation_id, 100);
  assert.equal(data.members[0].reversed_by_operation_id, 100);
  assert.equal(data.decisions[0].state_version, 1);
  assert.equal(data.adjustments.length, potTreatment === "REVERSE" ? 0 : 1);
});

test("exceptional reactivation without membership has no counted contribution", async t => {
  const data = fixtures(t);
  data.members.length = 0;
  const built = await buildEliminationCorrection({ ...intent, potTreatment: "KEEP_TOTAL" }, transaction, false, { now });
  assert.equal(built.potImpact.adjustmentCents, 0);
  await commitEliminationCorrection(built, { id: 100 }, transaction);
  assert.equal(data.adjustments.length, 0);
});

test("invalid and stale correction selections fail before writes", async t => {
  const data = fixtures(t);
  const build = (input = intent) => buildEliminationCorrection(input, transaction, false, { now });
  for (const input of [{ ...intent, trackId: 0 }, { ...intent, pickId: 0 }, { ...intent, potTreatment: "invent" }, { ...intent, explanation: " " }, { ...intent, explanation: "x".repeat(501) }, { ...intent, pickId: 12 }, { ...intent, pickId: 99 }]) await assert.rejects(build(input));
  data.track.eliminated_by_pick_id = 11;
  await assert.rejects(build(), /already eliminated/);
  data.track.eliminated_by_pick_id = null;
  data.track.league_season_id = 9;
  await assert.rejects(build(), /not found/);
  data.track.league_season_id = 3;
  data.decisions[0].user_id = 55;
  await assert.rejects(build(), /membership/);
  data.decisions[0].user_id = 2;
  data.decisions[0].status = "PENDING_USER_REQUEST";
  await assert.rejects(build(), /pending buyback/);
  data.decisions[0].status = "COMPLETED_ADMIN_DIRECT";
  data.events.length = 0;
  await assert.rejects(build(), /no active reactivation/);
  data.events.push({ id: 21, waived_pick_id: 11 });
  data.picks.unshift({ id: 9, week: 0, outcome: "WRONG_PICK" });
  await assert.rejects(build(), /earlier Wrong Pick/);
  data.picks.shift();
  data.schedule.normalized_schedule.games = [];
  await assert.rejects(build(), /validated/);
  t.mock.method(models.LeagueSeason, "findOne", async () => null);
  await assert.rejects(build(), /active League Season/);
  assert.equal(data.adjustments.length, 0);
});

test("pot includes audited adjustments and rejects missing exemption", async t => {
  const data = fixtures(t);
  t.mock.method(models.sequelize, "transaction", async (_options, work) => work(transaction));
  data.money.adjustmentCents = 1000;
  assert.equal((await getLeaguePot()).totalCents, 2500);
  t.mock.method(models.sequelize, "query", async () => []);
  await assert.rejects(getLeaguePot(), /exemption/);
  t.mock.method(models.LeagueSeason, "findOne", async () => null);
  assert.deepEqual(await getLeaguePot(), { leagueSeason: null });
});
