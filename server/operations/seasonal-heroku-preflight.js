const { Op } = require("sequelize");

const SHUTDOWN_ALLOWED_STATES = Object.freeze(["COMPLETE", "ROLLED_OVER"]);
const SHUTDOWN_BLOCKED_STATES = Object.freeze(["SETUP", "ACTIVE"]);
const PENDING_REMINDER_STATES = Object.freeze([
  "PENDING",
  "CLAIMED",
  "TEMPORARILY_FAILED",
]);
const PENDING_PUSH_DELIVERY_STATES = Object.freeze([
  "PENDING",
  "CLAIMED",
  "TEMPORARILY_FAILED",
]);

function seasonView(season) {
  if (!season) return null;
  return {
    id: season.id,
    year: season.year,
    state: season.state,
    week: season.current_week,
    schedulePhase: season.schedule_phase,
    stateVersion: season.state_version,
  };
}

function addBlocker(blockers, code, detail = {}) {
  blockers.push({ code, ...detail });
}

function shutdownDecision({ currentSeason, openSeason, counts }) {
  const blockers = [];
  if (!currentSeason) {
    addBlocker(blockers, "NO_LEAGUE_SEASON");
  } else if (SHUTDOWN_BLOCKED_STATES.includes(currentSeason.state)) {
    addBlocker(blockers, "LEAGUE_SEASON_OPEN", {
      state: currentSeason.state,
      year: currentSeason.year,
    });
  } else if (!SHUTDOWN_ALLOWED_STATES.includes(currentSeason.state)) {
    addBlocker(blockers, "LEAGUE_SEASON_STATE_UNAPPROVED", {
      state: currentSeason.state,
      year: currentSeason.year,
    });
  }

  if (openSeason && openSeason.id !== currentSeason?.id) {
    addBlocker(blockers, "OPEN_LEAGUE_SEASON_EXISTS", {
      state: openSeason.state,
      year: openSeason.year,
    });
  }

  if (counts.activeAdminPreviews > 0) {
    addBlocker(blockers, "ADMIN_ACTION_PREVIEW_PENDING", {
      count: counts.activeAdminPreviews,
    });
  }
  if (counts.pendingReminderDeliveries > 0) {
    addBlocker(blockers, "REMINDER_DELIVERY_PENDING", {
      count: counts.pendingReminderDeliveries,
    });
  }
  if (counts.pendingPushDeviceDeliveries > 0) {
    addBlocker(blockers, "PUSH_DEVICE_DELIVERY_PENDING", {
      count: counts.pendingPushDeviceDeliveries,
    });
  }
  if (currentSeason?.state === "ACTIVE" && counts.currentAutoPickOperations < 1) {
    addBlocker(blockers, "AUTO_PICK_OPERATION_PENDING", {
      year: currentSeason.year,
      week: currentSeason.current_week,
    });
  }
  if (currentSeason?.state === "ACTIVE" && counts.currentCloseWeekOperations < 1) {
    addBlocker(blockers, "WEEK_CLOSURE_PENDING", {
      year: currentSeason.year,
      week: currentSeason.current_week,
    });
  }

  return { allowed: blockers.length === 0, blockers };
}

async function buildSeasonalDatabasePreflight({
  models,
  now = new Date(),
  mode = "shutdown",
} = {}) {
  if (!models) throw new Error("models are required");
  if (!["shutdown", "reactivation"].includes(mode)) {
    throw new Error("mode must be shutdown or reactivation");
  }

  const {
    LeagueSeason,
    AdminActionPreview,
    LeagueWeekOperation,
    ReminderDelivery,
    PushDeviceDelivery,
    sequelize,
  } = models;

  if (sequelize?.authenticate) await sequelize.authenticate();

  const [openSeason, currentSeason, activeAdminPreviews] = await Promise.all([
    LeagueSeason.findOne({
      where: { open_slot: 1 },
      attributes: [
        "id",
        "year",
        "state",
        "current_week",
        "schedule_phase",
        "state_version",
      ],
    }),
    LeagueSeason.findOne({
      attributes: [
        "id",
        "year",
        "state",
        "current_week",
        "schedule_phase",
        "state_version",
      ],
      order: [
        ["year", "DESC"],
        ["id", "DESC"],
      ],
    }),
    AdminActionPreview.count({
      where: {
        consumed_at: null,
        expires_at: { [Op.gt]: now },
      },
    }),
  ]);

  const currentSeasonWhere = currentSeason
    ? { league_season_id: currentSeason.id, week: currentSeason.current_week }
    : { league_season_id: -1, week: -1 };

  const [
    pendingReminderDeliveries,
    pendingPushDeviceDeliveries,
    currentAutoPickOperations,
    currentCloseWeekOperations,
  ] = await Promise.all([
    ReminderDelivery.count({
      where: { state: { [Op.in]: PENDING_REMINDER_STATES } },
    }),
    PushDeviceDelivery.count({
      where: { state: { [Op.in]: PENDING_PUSH_DELIVERY_STATES } },
    }),
    LeagueWeekOperation.count({
      where: { ...currentSeasonWhere, phase: "AUTO_PICK" },
    }),
    LeagueWeekOperation.count({
      where: { ...currentSeasonWhere, phase: "CLOSE_WEEK" },
    }),
  ]);

  const counts = {
    activeAdminPreviews,
    pendingReminderDeliveries,
    pendingPushDeviceDeliveries,
    currentAutoPickOperations,
    currentCloseWeekOperations,
  };
  const shutdown = shutdownDecision({ currentSeason, openSeason, counts });

  return {
    mode,
    checkedAt: now.toISOString(),
    database: { reachable: true },
    currentSeason: seasonView(currentSeason),
    openSeason: seasonView(openSeason),
    counts,
    shutdown,
    reactivation: {
      databaseReachable: true,
      requiresOwnerConfigNameVerification: true,
      nextSeasonActivationBlockedUntilProductionChecksPass: true,
    },
  };
}

module.exports = {
  PENDING_PUSH_DELIVERY_STATES,
  PENDING_REMINDER_STATES,
  SHUTDOWN_ALLOWED_STATES,
  buildSeasonalDatabasePreflight,
  shutdownDecision,
};
