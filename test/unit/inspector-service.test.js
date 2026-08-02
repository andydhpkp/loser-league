const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  User,
  Track,
  Pick,
  LeagueSeason,
  ScheduleSnapshot,
  TrackReactivation,
  AdminAuditTarget,
} = require("../../models");
const { inspectTrack } = require("../../server/modules/admin-repairs/inspector-service");

test("Track inspector returns normalized state and flags projection inconsistencies", async (t) => {
  const track = {
    id: 17,
    user_id: 7,
    league_season_id: 23,
    eliminated_by_pick_id: null,
    state_version: 5,
    current_pick: "Denver Broncos",
    used_picks: ["Denver Broncos", "Denver Broncos"],
    available_picks: ["Denver Broncos", "Las Vegas Raiders"],
    wrong_pick: null,
  };
  const season = {
    id: 23,
    year: 2026,
    state: "ACTIVE",
    current_week: 2,
    pick_cycle: 0,
    state_version: 8,
  };
  const picks = [{
    id: 29,
    track_id: 17,
    week: 1,
    pick_cycle: 0,
    team_name: "Denver Broncos",
    origin: "USER_SUBMISSION",
    outcome: "PREDICTION_CORRECT",
    schedule_hash: "a".repeat(64),
    state_version: 2,
  }];
  const createdAt = new Date("2026-09-20T17:00:00.000Z");

  t.mock.method(Track, "findByPk", async () => track);
  t.mock.method(User, "findByPk", async () => ({
    id: 7,
    first_name: "Alex",
    last_name: "Viewer",
    username: "alex",
    get password() {
      throw new Error("Track inspection must not read User credentials");
    },
  }));
  t.mock.method(LeagueSeason, "findByPk", async () => season);
  t.mock.method(Pick, "findAll", async () => picks);
  t.mock.method(TrackReactivation, "findAll", async () => [{
    id: 44,
    waived_pick_id: 28,
    admin_audit_operation_id: 80,
    createdAt,
  }]);
  t.mock.method(AdminAuditTarget, "findAll", async () => [{
    operation: {
      id: 81,
      action: "RESET_CURRENT_PICK",
      description: "Reset one pending Pick",
      status: "COMMITTED",
      undoable: true,
      undone_by_operation_id: null,
      createdAt,
    },
  }]);
  t.mock.method(ScheduleSnapshot, "findOne", async () => ({
    normalized_schedule: {
      games: [{
        homeTeam: "Denver Broncos",
        awayTeam: "Las Vegas Raiders",
      }],
    },
  }));

  const view = await inspectTrack(17);

  assert.deepEqual(view, {
    user: {
      id: 7,
      displayName: "Alex Viewer",
      username: "alex",
    },
    track: {
      id: 17,
      active: true,
      stateVersion: 5,
      eliminatingPickId: null,
    },
    leagueSeason: {
      id: 23,
      year: 2026,
      state: "ACTIVE",
      week: 2,
      pickCycle: 0,
      stateVersion: 8,
    },
    picks: [{
      id: 29,
      week: 1,
      pickCycle: 0,
      teamName: "Denver Broncos",
      origin: "USER_SUBMISSION",
      outcome: "PREDICTION_CORRECT",
      scheduleHash: "a".repeat(64),
      stateVersion: 2,
    }],
    projections: {
      currentPick: "Denver Broncos",
      usedPicks: ["Denver Broncos", "Denver Broncos"],
      availablePicks: ["Denver Broncos", "Las Vegas Raiders"],
      wrongPick: null,
    },
    eligibleCurrentWeekTeams: ["Denver Broncos", "Las Vegas Raiders"],
    inconsistencies: [
      "Current Pick projection does not match normalized Picks",
      "Used and available Pick projections are inconsistent",
    ],
    reactivations: [{
      id: 44,
      waivedPickId: 28,
      auditOperationId: 80,
      createdAt,
    }],
    recentOperations: [{
      id: 81,
      action: "RESET_CURRENT_PICK",
      description: "Reset one pending Pick",
      status: "COMMITTED",
      undoable: true,
      createdAt,
    }],
  });
  assert.equal("password" in view.user, false);
});
