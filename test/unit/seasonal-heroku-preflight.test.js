const assert = require("node:assert/strict");
const test = require("node:test");
const { Op } = require("sequelize");

const {
  buildSeasonalDatabasePreflight,
  shutdownDecision,
} = require("../../server/operations/seasonal-heroku-preflight");
const {
  parseMode,
} = require("../../scripts/seasonal-heroku-database-preflight");

const now = new Date("2026-08-31T12:00:00Z");

function models({ currentSeason, openSeason = null, counts = {} } = {}) {
  return {
    sequelize: { authenticate: async () => {} },
    LeagueSeason: {
      calls: [],
      async findOne(query) {
        this.calls.push(query);
        if (query.where?.open_slot === 1) return openSeason;
        return currentSeason;
      },
    },
    AdminActionPreview: {
      count: async () => counts.activeAdminPreviews || 0,
    },
    ReminderDelivery: {
      count: async () => counts.pendingReminderDeliveries || 0,
    },
    PushDeviceDelivery: {
      count: async () => counts.pendingPushDeviceDeliveries || 0,
    },
    LeagueWeekOperation: {
      async count(query) {
        if (query.where.phase === "AUTO_PICK") {
          return counts.currentAutoPickOperations || 0;
        }
        if (query.where.phase === "CLOSE_WEEK") {
          return counts.currentCloseWeekOperations || 0;
        }
        return 0;
      },
    },
  };
}

test("shutdown allows complete or rolled-over seasons with no pending work", () => {
  for (const state of ["COMPLETE", "ROLLED_OVER"]) {
    const result = shutdownDecision({
      currentSeason: { id: 4, year: 2026, state, current_week: 18 },
      openSeason: null,
      counts: {
        activeAdminPreviews: 0,
        pendingReminderDeliveries: 0,
        pendingPushDeviceDeliveries: 0,
        currentAutoPickOperations: 0,
        currentCloseWeekOperations: 0,
      },
    });
    assert.deepEqual(result, { allowed: true, blockers: [] });
  }
});

test("shutdown blocks setup and active seasons", () => {
  for (const state of ["SETUP", "ACTIVE"]) {
    const result = shutdownDecision({
      currentSeason: { id: 4, year: 2026, state, current_week: state === "SETUP" ? 0 : 3 },
      openSeason: { id: 4, year: 2026, state, current_week: state === "SETUP" ? 0 : 3 },
      counts: {
        activeAdminPreviews: 0,
        pendingReminderDeliveries: 0,
        pendingPushDeviceDeliveries: 0,
        currentAutoPickOperations: 1,
        currentCloseWeekOperations: 1,
      },
    });
    assert.equal(result.allowed, false);
    assert.equal(result.blockers[0].code, "LEAGUE_SEASON_OPEN");
    assert.equal(result.blockers[0].state, state);
  }
});

test("shutdown reports pending operational blockers as aggregate counts", () => {
  const result = shutdownDecision({
    currentSeason: { id: 4, year: 2026, state: "COMPLETE", current_week: 18 },
    openSeason: null,
    counts: {
      activeAdminPreviews: 2,
      pendingReminderDeliveries: 3,
      pendingPushDeviceDeliveries: 4,
      currentAutoPickOperations: 0,
      currentCloseWeekOperations: 0,
    },
  });

  assert.equal(result.allowed, false);
  assert.deepEqual(
    result.blockers.map(({ code, count }) => ({ code, count })),
    [
      { code: "ADMIN_ACTION_PREVIEW_PENDING", count: 2 },
      { code: "REMINDER_DELIVERY_PENDING", count: 3 },
      { code: "PUSH_DEVICE_DELIVERY_PENDING", count: 4 },
    ]
  );
});

test("database preflight emits sanitized season and readiness shape", async () => {
  const currentSeason = {
    id: 9,
    year: 2026,
    state: "COMPLETE",
    current_week: 18,
    schedule_phase: "REGULAR",
    state_version: 7,
  };
  const summary = await buildSeasonalDatabasePreflight({
    models: models({ currentSeason }),
    now,
    mode: "shutdown",
  });

  assert.equal(summary.checkedAt, "2026-08-31T12:00:00.000Z");
  assert.deepEqual(summary.database, { reachable: true });
  assert.deepEqual(summary.currentSeason, {
    id: 9,
    year: 2026,
    state: "COMPLETE",
    week: 18,
    schedulePhase: "REGULAR",
    stateVersion: 7,
  });
  assert.equal(summary.shutdown.allowed, true);
  assert.equal(summary.reactivation.requiresOwnerConfigNameVerification, true);
  assert.equal(JSON.stringify(summary).includes("password"), false);
  assert.equal(JSON.stringify(summary).includes("JAWSDB"), false);
});

test("database preflight queries active previews and pending delivery states", async () => {
  const fakeModels = models({
    currentSeason: {
      id: 9,
      year: 2026,
      state: "COMPLETE",
      current_week: 18,
      schedule_phase: "REGULAR",
      state_version: 7,
    },
  });
  const queries = [];
  fakeModels.AdminActionPreview.count = async (query) => {
    queries.push(["preview", query.where]);
    return 0;
  };
  fakeModels.ReminderDelivery.count = async (query) => {
    queries.push(["reminder", query.where]);
    return 0;
  };
  fakeModels.PushDeviceDelivery.count = async (query) => {
    queries.push(["push", query.where]);
    return 0;
  };

  await buildSeasonalDatabasePreflight({ models: fakeModels, now });

  assert.equal(queries[0][0], "preview");
  assert.deepEqual(Object.keys(queries[0][1]).sort(), ["consumed_at", "expires_at"]);
  assert.equal(queries[1][0], "reminder");
  assert.deepEqual(queries[1][1].state[Op.in], [
    "PENDING",
    "CLAIMED",
    "TEMPORARILY_FAILED",
  ]);
  assert.equal(queries[2][0], "push");
  assert.deepEqual(queries[2][1].state[Op.in], [
    "PENDING",
    "CLAIMED",
    "TEMPORARILY_FAILED",
  ]);
});

test("database preflight argument parser defaults to shutdown", () => {
  assert.equal(parseMode([]), "shutdown");
  assert.equal(parseMode(["--mode", "reactivation"]), "reactivation");
  assert.throws(() => parseMode(["--mode", "hibernate"]), /shutdown or reactivation/);
  assert.throws(() => parseMode(["--app", "loser-league"]), /Usage/);
});
