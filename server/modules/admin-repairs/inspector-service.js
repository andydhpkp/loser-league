const {
  User,
  Track,
  Pick,
  LeagueSeason,
  ScheduleSnapshot,
  TrackReactivation,
  AdminAuditOperation,
  AdminAuditTarget,
} = require("../../../models");
const { NotFoundError } = require("../../lib/errors");

function pickView(pick) {
  return {
    id: pick.id,
    week: pick.week,
    pickCycle: pick.pick_cycle,
    teamName: pick.team_name,
    origin: pick.origin,
    outcome: pick.outcome,
    scheduleHash: pick.schedule_hash,
    stateVersion: pick.state_version,
  };
}

async function inspectTrack(trackId) {
  const id = Number(trackId);
  if (!Number.isInteger(id) || id < 1) throw new NotFoundError("Track not found");
  const track = await Track.findByPk(id);
  if (!track) throw new NotFoundError("Track not found");
  const [user, season, picks, reactivations, auditTargets] = await Promise.all([
    User.findByPk(track.user_id, { attributes: ["id", "first_name", "last_name", "username"] }),
    LeagueSeason.findByPk(track.league_season_id),
    Pick.findAll({ where: { track_id: id, league_season_id: track.league_season_id }, order: [["pick_cycle", "ASC"], ["week", "ASC"], ["id", "ASC"]] }),
    TrackReactivation.findAll({ where: { track_id: id }, order: [["createdAt", "DESC"]] }),
    AdminAuditTarget.findAll({
      where: { target_type: "TRACK", target_id: id },
      include: [{ model: AdminAuditOperation, as: "operation", attributes: ["id", "action", "description", "status", "undoable", "undone_by_operation_id", "createdAt"] }],
      order: [["id", "DESC"]],
      limit: 20,
    }),
  ]);
  if (!user || !season) throw new NotFoundError("Track league state not found");
  const schedule = season.state === "ACTIVE" ? await ScheduleSnapshot.findOne({
    where: { league_season_id: season.id, week: season.current_week, provider: season.schedule_phase === "PRESEASON" ? "ESPN" : "FIXTURE_DOWNLOAD" },
    order: [["fetched_at", "DESC"]],
  }) : null;
  const scheduledTeams = new Set((schedule?.normalized_schedule?.games || []).flatMap((game) => [game.homeTeam, game.awayTeam]));
  const currentPick = picks.find((pick) => pick.pick_cycle === season.pick_cycle && pick.week === season.current_week && pick.outcome === "PENDING") || null;
  const inconsistencies = [];
  if ((currentPick?.team_name || null) !== (track.current_pick || null)) inconsistencies.push("Current Pick projection does not match normalized Picks");
  if (new Set(track.used_picks).size !== track.used_picks.length || track.used_picks.some((team) => track.available_picks.includes(team))) inconsistencies.push("Used and available Pick projections are inconsistent");
  return {
    user: { id: user.id, displayName: `${user.first_name} ${user.last_name}`.trim(), username: user.username },
    track: { id: track.id, active: track.eliminated_by_pick_id === null, stateVersion: track.state_version, eliminatingPickId: track.eliminated_by_pick_id },
    leagueSeason: { id: season.id, year: season.year, state: season.state, week: season.current_week, pickCycle: season.pick_cycle, stateVersion: season.state_version },
    picks: picks.map(pickView),
    projections: { currentPick: track.current_pick, usedPicks: [...track.used_picks], availablePicks: [...track.available_picks], wrongPick: track.wrong_pick },
    eligibleCurrentWeekTeams: track.available_picks.filter((team) => scheduledTeams.has(team)),
    inconsistencies,
    reactivations: reactivations.map((item) => ({ id: item.id, waivedPickId: item.waived_pick_id, auditOperationId: item.admin_audit_operation_id, createdAt: item.createdAt })),
    recentOperations: auditTargets.map((target) => ({
      id: target.operation.id,
      action: target.operation.action,
      description: target.operation.description,
      status: target.operation.status,
      undoable: target.operation.undoable && target.operation.status === "COMMITTED" && !target.operation.undone_by_operation_id,
      createdAt: target.operation.createdAt,
    })),
  };
}

async function inspectUserWorkspace(userId, { inspect = inspectTrack } = {}) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id < 1) throw new NotFoundError("User not found");
  const [user, season] = await Promise.all([
    User.findByPk(id, { attributes: ["id", "first_name", "last_name", "username", "user_record"] }),
    LeagueSeason.findOne({ where: { open_slot: 1 }, attributes: ["id"] }),
  ]);
  if (!user) throw new NotFoundError("User not found");
  const tracks = season ? await Track.findAll({
    where: { user_id: id, league_season_id: season.id },
    attributes: ["id"],
    order: [["id", "ASC"]],
  }) : [];
  return {
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      user_record: user.user_record || [],
      crown_type: user.getCrownType(),
    },
    tracks: await Promise.all(tracks.map((track) => inspect(track.id))),
  };
}

module.exports = { inspectTrack, inspectUserWorkspace };
