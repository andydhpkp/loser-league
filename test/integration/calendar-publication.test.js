const test = require("node:test");
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("Pick deadline calendar publication", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  const assert = require("node:assert/strict");
  const { sequelize, LeagueSeason, CalendarEvent, CalendarFeedState } = require("../../models");
  const { migrateEmptyTestDatabase } = require("../support/migrate-test-database");
  const { createCalendarService } = require("../../server/modules/calendar/calendar-service");

  test.beforeEach(async () => migrateEmptyTestDatabase(sequelize));
  test.after(async () => sequelize.close());

  test("migration adds generic constrained publication state and refresh survives schedule updates", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 1, schedule_phase: "REGULAR", state_version: 1, open_slot: 1 });
    let deadline = new Date("2026-09-10T23:30:00Z"); let sourceHash = "a".repeat(64);
    const events = [];
    const service = createCalendarService({ loadSchedule: async () => ({ season, evidence: [{ year: 2026, phase: "REGULAR", round: 1, deadline, sourceHash }], invalidKeys: [] }), configuration: { dashboardUrl: "https://example.invalid/dashboard.html" }, now: () => new Date("2026-08-13T12:00:00Z"), logger: { info: (event, context) => events.push({ event, context }), warn() {} } });
    await service.refresh(); await service.refresh();
    assert.equal(await CalendarEvent.count(), 1); assert.equal((await CalendarEvent.findOne()).sequence, 0);
    assert.deepEqual(events, [{ event: "calendar_refresh_committed", context: { created: 1, updated: 0, cancelled: 0 } }]);
    const first = await CalendarFeedState.findByPk(1);
    deadline = new Date("2026-09-11T00:00:00Z"); sourceHash = "b".repeat(64); await service.refresh();
    const event = await CalendarEvent.findOne(); const second = await CalendarFeedState.findByPk(1);
    assert.equal(event.sequence, 1); assert.equal(event.event_uid, "pick-deadline-2026-regular-1@calendar.loser-league.app"); assert.notEqual(second.content_hash, first.content_hash);
    assert.deepEqual(events[1], { event: "calendar_refresh_committed", context: { created: 0, updated: 1, cancelled: 0 } });
    for (const forbidden of ["user_id", "email", "track", "pick", "team", "token"]) assert.equal((await sequelize.getQueryInterface().describeTable("calendar_event"))[forbidden], undefined);
  });

  test("provider failure preserves the exact last trustworthy representation", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 1, schedule_phase: "REGULAR", state_version: 1, open_slot: 1 }); let fail = false;
    const service = createCalendarService({ loadSchedule: async () => { if (fail) throw new Error("temporary"); return { season, evidence: [{ year: 2026, phase: "REGULAR", round: 1, deadline: new Date("2026-09-10T23:30:00Z"), sourceHash: "c".repeat(64) }], invalidKeys: [] }; }, configuration: { dashboardUrl: "https://example.invalid/dashboard.html" }, logger: { info() {}, warn() {} } });
    await service.refresh(); const before = await service.getFeed({ available: true }); fail = true; assert.deepEqual(await service.refresh(), { status: "FALLBACK" }); const after = await service.getFeed({ available: true });
    assert.deepEqual(after, before);
  });

  test("concurrent refreshes converge on one stable event identity and sequence", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 1, schedule_phase: "REGULAR", state_version: 1, open_slot: 1 });
    const input = { season, evidence: [{ year: 2026, phase: "REGULAR", round: 1, deadline: new Date("2026-09-10T23:30:00Z"), sourceHash: "d".repeat(64) }], invalidKeys: [] };
    const makeService = () => createCalendarService({ loadSchedule: async () => input, configuration: { dashboardUrl: "https://example.invalid/dashboard.html" }, logger: { info() {}, warn() {} } });
    const results = await Promise.allSettled([makeService().refresh(), makeService().refresh()]);
    assert.equal(results.some(({ status }) => status === "fulfilled"), true); assert.equal(await CalendarEvent.count(), 1); assert.equal(await CalendarFeedState.count(), 1); assert.equal((await CalendarEvent.findOne()).sequence, 0);
  });
}
