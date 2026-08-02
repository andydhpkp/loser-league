const crypto = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { Transaction } = require("sequelize");
const {
  sequelize,
  User,
  Track,
  Pick,
  TrackReactivation,
  Team,
  LeagueSeason,
  LeagueWeekOperation,
  ScheduleSnapshot,
  OfficialGameResultOverride,
  AdminActionPreview,
  AdminAuditOperation,
  AdminAuditTarget,
} = require("../../models");
const { ConflictError, NotFoundError, ValidationError } = require("../lib/errors");
const { getAdminAction } = require("./action-registry");
const { closeWeek } = require("../modules/week-closure/week-closure-service");
const { planAssignCurrentPick, planBuybackReactivation, planPlayoffPoolReset, planReplaceCurrentPick, planResetCurrentPick } = require("../modules/admin-repairs/repair-policy");

const PREVIEW_TTL_MS = 10 * 60 * 1000;
const hashKey = (key) => crypto.createHash("sha256").update(key).digest("hex");
const positiveId = (value, label) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new ValidationError(`${label} must be a positive integer`);
  return id;
};
const normalizeNote = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > 500) throw new ValidationError("Note must be at most 500 characters");
  return value.trim() || null;
};
const userWinState = (user) => ({ userRecord: user.user_record || [], stateVersion: user.updatedAt?.getTime?.() || null });
const trackState = (track) => ({ leagueSeasonId: track.league_season_id, stateVersion: track.state_version });
const repairTrackState = (track) => ({
  leagueSeasonId: track.league_season_id,
  currentPick: track.current_pick,
  usedPicks: [...track.used_picks],
  availablePicks: [...track.available_picks],
  wrongPick: track.wrong_pick,
  eliminatedByPickId: track.eliminated_by_pick_id,
  stateVersion: track.state_version,
});
const repairPickState = (pick) => ({
  trackId: pick.track_id,
  leagueSeasonId: pick.league_season_id,
  week: pick.week,
  pickCycle: pick.pick_cycle,
  teamName: pick.team_name,
  origin: pick.origin,
  outcome: pick.outcome,
  scheduleHash: pick.schedule_hash,
  stateVersion: pick.state_version,
});
const cleanText = (value, label, maxLength, required = true) => {
  if (typeof value !== "string" || (required && !value.trim()) || value.trim().length > maxLength) throw new ValidationError(`${label} is invalid`);
  return value.trim() || null;
};
const score = (value, label) => {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 0) throw new ValidationError(`${label} must be a non-negative integer`);
  return result;
};
const matchupKey = (homeTeam, awayTeam) => [homeTeam, awayTeam].sort().join("|");
const normalizeSourceUrl = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const sourceUrl = cleanText(value, "Source URL", 2048);
  let parsed;
  try { parsed = new URL(sourceUrl); } catch (_error) { throw new ValidationError("Source URL is invalid"); }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new ValidationError("Source URL is invalid");
  return sourceUrl;
};

async function openSeason(transaction, lock = false) {
  const season = await LeagueSeason.findOne({ where: { open_slot: 1 }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!season) throw new ConflictError("No open League Season exists");
  return season;
}

async function buildActionPreview(action, input, transaction, lock = false, { manualClosureContext } = {}) {
  if (!getAdminAction(action)) throw new NotFoundError("Admin action not found");
  if (action === "ADD_USER_WIN") {
    const userId = positiveId(input.userId, "User ID");
    const year = Number(input.year);
    if (!Number.isInteger(year) || year < 1000 || year > 9999 || typeof input.wonWithTie !== "boolean") throw new ValidationError("A four-digit year and boolean win type are required");
    const user = await User.findByPk(userId, { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!user) throw new NotFoundError("User not found");
    const before = userWinState(user);
    const existing = before.userRecord.find((record) => Number(record.year) === year);
    const afterRecord = existing
      ? before.userRecord.map((record) => Number(record.year) === year ? { ...record, won: true, won_with_tie: Boolean(record.won_with_tie || input.wonWithTie) } : record)
      : [...before.userRecord, { year, won: true, won_with_tie: input.wonWithTie }];
    return { normalizedIntent: { userId, year, wonWithTie: input.wonWithTie }, description: `Record ${input.wonWithTie ? "tied" : "solo"} win for User ${userId} in ${year}`, warnings: [], leagueSeason: null, targets: [{ targetType: "USER", targetId: userId, beforeState: before, afterState: { userRecord: afterRecord } }] };
  }

  if (action === "CREATE_TRACK") {
    const userId = positiveId(input.userId, "User ID");
    const user = await User.findByPk(userId, { attributes: ["id"], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!user) throw new NotFoundError("User not found");
    const season = await openSeason(transaction, lock);
    if (season.state !== "SETUP" && !(season.state === "ACTIVE" && season.current_week === 1)) throw new ConflictError("Track enrollment is closed");
    return { normalizedIntent: { userId }, description: `Create Track for User ${userId}`, warnings: [], leagueSeason: season, targets: [{ targetType: "USER", targetId: userId, beforeState: { exists: true }, afterState: { trackCreated: true } }] };
  }

  if (action === "DELETE_TRACK") {
    const trackId = positiveId(input.trackId, "Track ID");
    const track = await Track.findByPk(trackId, { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!track) throw new NotFoundError("Track not found");
    const season = track.league_season_id ? await LeagueSeason.findByPk(track.league_season_id, { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }) : null;
    return { normalizedIntent: { trackId }, description: `Permanently delete Track ${trackId}`, warnings: ["This action cannot be undone."], leagueSeason: season, targets: [{ targetType: "TRACK", targetId: trackId, beforeState: trackState(track), afterState: null }] };
  }

  if (action === "OVERRIDE_GAME_RESULT") {
    const season = await openSeason(transaction, lock);
    if (season.state !== "ACTIVE") throw new ConflictError("Official results require an active League Season");
    const homeTeam = cleanText(input.homeTeam, "Home Team", 255);
    const awayTeam = cleanText(input.awayTeam, "Away Team", 255);
    if (homeTeam === awayTeam) throw new ValidationError("Matchup Teams must differ");
    const homeScore = score(input.homeScore, "Home score");
    const awayScore = score(input.awayScore, "Away score");
    const explanation = cleanText(input.explanation, "Explanation", 500);
    const sourceUrl = normalizeSourceUrl(input.sourceUrl);
    const schedule = await ScheduleSnapshot.findOne({ where: { league_season_id: season.id, week: season.current_week, provider: "FIXTURE_DOWNLOAD" }, order: [["fetched_at", "DESC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!schedule) throw new ConflictError("A validated weekly schedule is required");
    const game = schedule.normalized_schedule?.games?.find((candidate) => candidate.homeTeam === homeTeam && candidate.awayTeam === awayTeam);
    if (!game) throw new ValidationError("Matchup does not match the current Fixture schedule");
    const key = matchupKey(homeTeam, awayTeam);
    const existingOverride = await OfficialGameResultOverride.findOne({ where: { league_season_id: season.id, week: season.current_week, matchup_key: key }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    const tied = homeScore === awayScore;
    const resultState = { homeTeam, awayTeam, homeScore, awayScore, winnerTeam: tied ? null : homeScore > awayScore ? homeTeam : awayTeam, loserTeam: tied ? null : homeScore < awayScore ? homeTeam : awayTeam, tied, scheduleHash: schedule.content_hash, explanation, sourceUrl };
    if (existingOverride) {
      const same = existingOverride.home_score === homeScore && existingOverride.away_score === awayScore && existingOverride.schedule_hash === schedule.content_hash && existingOverride.explanation === explanation && (existingOverride.source_url || null) === sourceUrl;
      if (!same) throw new ConflictError("An immutable official result already exists for this matchup");
    }
    return {
      normalizedIntent: resultState,
      description: `Record official ${homeTeam} vs ${awayTeam} result for Week ${season.current_week}`,
      warnings: ["This result is immutable."],
      leagueSeason: season,
      scheduleHash: schedule.content_hash,
      existingAuditOperationId: existingOverride?.admin_audit_operation_id || null,
      targets: [{ targetType: "LEAGUE_SEASON", targetId: season.id, beforeState: { officialResult: existingOverride ? resultState : null, stateVersion: season.state_version }, afterState: { officialResult: resultState, stateVersion: season.state_version } }],
    };
  }

  if (action === "CLOSE_WEEK") {
    const season = await openSeason(transaction, lock);
    if (season.state !== "ACTIVE") throw new ConflictError("Manual closure requires an active League Season");
    const context = manualClosureContext;
    if (!context || context.leagueSeasonId !== season.id || context.week !== season.current_week || !/^[a-f0-9]{64}$/i.test(context.scheduleHash || "") || !Array.isArray(context.games) || !Array.isArray(context.selectedTeamNames) || !Array.isArray(context.unfinishedUnselectedGames)) {
      throw new ConflictError("Current authoritative results are required for manual closure");
    }
    for (const teamName of context.selectedTeamNames) {
      const game = context.games.find((candidate) => candidate.homeTeam === teamName || candidate.awayTeam === teamName);
      if (!game || game.status !== "FINAL") throw new ConflictError("Every active Track's selected game must be final");
    }
    const nextWeek = season.current_week < 22 ? season.current_week + 1 : 22;
    return {
      normalizedIntent: { leagueSeasonId: season.id, week: season.current_week, scheduleHash: context.scheduleHash, games: context.games, unfinishedUnselectedGames: context.unfinishedUnselectedGames },
      description: `Manually close Week ${season.current_week} of the ${season.year} League Season`,
      warnings: context.unfinishedUnselectedGames.length ? ["Unfinished unselected games will not reopen this week."] : [],
      unfinishedUnselectedGames: context.unfinishedUnselectedGames,
      leagueSeason: season,
      scheduleHash: context.scheduleHash,
      targets: [{ targetType: "LEAGUE_SEASON", targetId: season.id, beforeState: { week: season.current_week, stateVersion: season.state_version }, afterState: { week: nextWeek, stateVersion: season.state_version + 1 } }],
    };
  }

  if (action === "RESET_CURRENT_PICKS") {
    const season = await openSeason(transaction, lock);
    if (season.state !== "ACTIVE") throw new ConflictError("Current Pick reset requires an active League Season");
    const scope = input.scope;
    if (scope !== "SELECTED" && scope !== "ALL") throw new ValidationError("Reset scope must be SELECTED or ALL");
    let trackIds;
    if (scope === "SELECTED") {
      if (!Array.isArray(input.trackIds) || !input.trackIds.length) throw new ValidationError("At least one Track is required");
      trackIds = [...new Set(input.trackIds.map((value) => positiveId(value, "Track ID")))].sort((a, b) => a - b);
    }
    const tracks = await Track.findAll({
      where: { league_season_id: season.id, eliminated_by_pick_id: null, ...(trackIds ? { id: trackIds } : {}) },
      order: [["id", "ASC"]],
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    });
    if (trackIds && tracks.length !== trackIds.length) throw new ConflictError("Every selected Track must be active in the current League Season");
    const picks = tracks.length ? await Pick.findAll({
      where: { league_season_id: season.id, week: season.current_week, pick_cycle: season.pick_cycle, track_id: tracks.map((track) => track.id), outcome: "PENDING" },
      order: [["track_id", "ASC"]],
      transaction,
      ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
    }) : [];
    const pickByTrack = new Map(picks.map((pick) => [pick.track_id, pick]));
    const targets = [];
    const plans = [];
    for (const track of tracks) {
      const pick = pickByTrack.get(track.id);
      if (!pick) throw new ConflictError(scope === "SELECTED"
        ? "Every selected Track must have a pending current-week Pick"
        : "Every active Track must have a pending current-week Pick");
      let plan;
      try {
        plan = planResetCurrentPick({
          season: { id: season.id, state: season.state, currentWeek: season.current_week, pickCycle: season.pick_cycle },
          track: { id: track.id, eliminatedByPickId: track.eliminated_by_pick_id, currentPick: track.current_pick, usedPicks: track.used_picks, availablePicks: track.available_picks },
          pick: { id: pick.id, week: pick.week, teamName: pick.team_name, outcome: pick.outcome, pickCycle: pick.pick_cycle },
        });
      } catch (error) {
        throw new ConflictError(error.message);
      }
      const beforeTrack = repairTrackState(track);
      const afterTrack = { ...beforeTrack, ...plan.trackAfter, stateVersion: beforeTrack.stateVersion + 1 };
      targets.push({ targetType: "TRACK", targetId: track.id, beforeState: beforeTrack, afterState: afterTrack, stateVersion: afterTrack.stateVersion });
      targets.push({ targetType: "PICK", targetId: pick.id, beforeState: repairPickState(pick), afterState: null, stateVersion: pick.state_version });
      plans.push({ track, pick, plan });
    }
    if (!plans.length) throw new ConflictError("No active Track has a pending current-week Pick");
    return {
      normalizedIntent: { scope, trackIds: plans.map(({ track }) => track.id) },
      description: `Reset ${scope === "ALL" ? "every active Track's" : `${plans.length} selected Track${plans.length === 1 ? "'s" : "s'"}`} Week ${season.current_week} Pick`,
      warnings: ["Reset Tracks remain without a Pick until repaired."],
      leagueSeason: season,
      targets,
      plans,
      undoable: true,
    };
  }

  if (action === "ASSIGN_CURRENT_PICK") {
    const season = await openSeason(transaction, lock);
    if (season.state !== "ACTIVE") throw new ConflictError("Current Pick assignment requires an active League Season");
    const trackId = positiveId(input.trackId, "Track ID");
    const teamName = cleanText(input.teamName, "Team", 255);
    const track = await Track.findOne({ where: { id: trackId, league_season_id: season.id, eliminated_by_pick_id: null }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!track) throw new ConflictError("Track must be active in the current League Season");
    const existingPick = await Pick.findOne({ where: { track_id: trackId, league_season_id: season.id, week: season.current_week, pick_cycle: season.pick_cycle }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (existingPick) throw new ConflictError("Track already has a current-week Pick");
    const schedule = await ScheduleSnapshot.findOne({ where: { league_season_id: season.id, week: season.current_week, provider: "FIXTURE_DOWNLOAD" }, order: [["fetched_at", "DESC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!schedule) throw new ConflictError("A validated weekly schedule is required");
    const scheduledTeams = (schedule.normalized_schedule?.games || []).flatMap((game) => [game.homeTeam, game.awayTeam]);
    let plan;
    try {
      plan = planAssignCurrentPick({
        season: { id: season.id, state: season.state, currentWeek: season.current_week, pickCycle: season.pick_cycle },
        track: { id: track.id, eliminatedByPickId: track.eliminated_by_pick_id, currentPick: track.current_pick, usedPicks: track.used_picks, availablePicks: track.available_picks },
        teamName,
        scheduledTeams,
      });
    } catch (error) {
      throw new ConflictError(error.message);
    }
    const beforeTrack = repairTrackState(track);
    const afterTrack = { ...beforeTrack, ...plan.trackAfter, stateVersion: beforeTrack.stateVersion + 1 };
    return {
      normalizedIntent: { trackId, teamName },
      description: `Assign ${teamName} to Track ${trackId} for Week ${season.current_week}`,
      warnings: ["This explicit repair may be used after kickoff."],
      leagueSeason: season,
      scheduleHash: schedule.content_hash,
      targets: [{ targetType: "TRACK", targetId: track.id, beforeState: beforeTrack, afterState: afterTrack, stateVersion: afterTrack.stateVersion }],
      plan: { track, pick: plan.pickAfter, trackAfter: plan.trackAfter, scheduleHash: schedule.content_hash },
      undoable: true,
    };
  }

  if (action === "REPLACE_CURRENT_PICK") {
    const season = await openSeason(transaction, lock);
    if (season.state !== "ACTIVE") throw new ConflictError("Current Pick replacement requires an active League Season");
    const trackId = positiveId(input.trackId, "Track ID");
    const teamName = cleanText(input.teamName, "Team", 255);
    const track = await Track.findOne({ where: { id: trackId, league_season_id: season.id, eliminated_by_pick_id: null }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!track) throw new ConflictError("Track must be active in the current League Season");
    const pick = await Pick.findOne({ where: { track_id: trackId, league_season_id: season.id, week: season.current_week, pick_cycle: season.pick_cycle }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    const schedule = await ScheduleSnapshot.findOne({ where: { league_season_id: season.id, week: season.current_week, provider: "FIXTURE_DOWNLOAD" }, order: [["fetched_at", "DESC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!schedule) throw new ConflictError("A validated weekly schedule is required");
    const scheduledTeams = (schedule.normalized_schedule?.games || []).flatMap((game) => [game.homeTeam, game.awayTeam]);
    let plan;
    try {
      plan = planReplaceCurrentPick({
        season: { id: season.id, state: season.state, currentWeek: season.current_week, pickCycle: season.pick_cycle },
        track: { id: track.id, eliminatedByPickId: track.eliminated_by_pick_id, currentPick: track.current_pick, usedPicks: track.used_picks, availablePicks: track.available_picks },
        pick: pick && { id: pick.id, week: pick.week, teamName: pick.team_name, outcome: pick.outcome, pickCycle: pick.pick_cycle },
        teamName,
        scheduledTeams,
      });
    } catch (error) {
      throw new ConflictError(error.message);
    }
    const beforeTrack = repairTrackState(track);
    const afterTrack = { ...beforeTrack, ...plan.trackAfter, stateVersion: beforeTrack.stateVersion + 1 };
    const beforePick = repairPickState(pick);
    const afterPick = { ...beforePick, ...plan.pickAfter, stateVersion: beforePick.stateVersion + 1 };
    return {
      normalizedIntent: { trackId, teamName },
      description: `Replace Track ${trackId}'s Week ${season.current_week} Pick with ${teamName}`,
      warnings: ["This explicit repair may be used after kickoff."],
      leagueSeason: season,
      scheduleHash: schedule.content_hash,
      targets: [
        { targetType: "TRACK", targetId: track.id, beforeState: beforeTrack, afterState: afterTrack, stateVersion: afterTrack.stateVersion },
        { targetType: "PICK", targetId: pick.id, beforeState: beforePick, afterState: afterPick, stateVersion: afterPick.stateVersion },
      ],
      plan: { track, pick, pickAfter: plan.pickAfter, trackAfter: plan.trackAfter },
      undoable: true,
    };
  }

  if (action === "REACTIVATE_TRACK") {
    const season = await openSeason(transaction, lock);
    if (season.state !== "ACTIVE") throw new ConflictError("Track reactivation requires an active League Season");
    const trackId = positiveId(input.trackId, "Track ID");
    if (input.paymentConfirmed !== true) throw new ValidationError("Confirm that buyback payment was handled externally");
    const track = await Track.findOne({ where: { id: trackId, league_season_id: season.id }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!track) throw new NotFoundError("Track not found");
    const eliminatingPick = track.eliminated_by_pick_id ? await Pick.findByPk(track.eliminated_by_pick_id, { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }) : null;
    let plan;
    try {
      plan = planBuybackReactivation({
        track: { id: track.id, eliminatedByPickId: track.eliminated_by_pick_id, wrongPick: track.wrong_pick },
        eliminatingPick: eliminatingPick && { id: eliminatingPick.id, week: eliminatingPick.week, teamName: eliminatingPick.team_name, outcome: eliminatingPick.outcome },
      });
    } catch (error) {
      throw new ConflictError(error.message);
    }
    const existing = await TrackReactivation.findOne({ where: { waived_pick_id: plan.waivedPickId }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (existing) throw new ConflictError("This eliminating Pick was already reactivated");
    const beforeTrack = repairTrackState(track);
    const afterTrack = { ...beforeTrack, ...plan.trackAfter, stateVersion: beforeTrack.stateVersion + 1 };
    return {
      normalizedIntent: { trackId, paymentConfirmed: true },
      description: `Reactivate Track ${trackId} after buyback while preserving Week ${eliminatingPick.week} Wrong Pick ${eliminatingPick.team_name}`,
      warnings: ["League policy intends buyback for Week 1 only.", "Payment confirmation occurs outside the application and no payment data is stored."],
      leagueSeason: season,
      targets: [{ targetType: "TRACK", targetId: track.id, beforeState: beforeTrack, afterState: afterTrack, stateVersion: afterTrack.stateVersion }],
      plan: { track, waivedPickId: plan.waivedPickId, trackAfter: plan.trackAfter },
      undoable: true,
    };
  }

  if (action === "RESET_PLAYOFF_PICK_POOLS") {
    const season = await openSeason(transaction, lock);
    const [tracks, teams, weekPick, autoPick] = await Promise.all([
      Track.findAll({ where: { league_season_id: season.id }, order: [["id", "ASC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }),
      Team.findAll({ attributes: ["team_name"], order: [["id", "ASC"]], transaction }),
      Pick.findOne({ where: { league_season_id: season.id, week: 19 }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }),
      LeagueWeekOperation.findOne({ where: { league_season_id: season.id, week: 19, phase: "AUTO_PICK" }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }),
    ]);
    let plan;
    try {
      plan = planPlayoffPoolReset({
        season: { id: season.id, state: season.state, currentWeek: season.current_week, pickCycle: season.pick_cycle },
        tracks: tracks.map((track) => ({ id: track.id, currentPick: track.current_pick, eliminatedByPickId: track.eliminated_by_pick_id })),
        teamNames: teams.map((team) => team.team_name),
        hasWeekPick: Boolean(weekPick),
        hasAutoPick: Boolean(autoPick),
      });
    } catch (error) {
      throw new ConflictError(error.message);
    }
    const beforeSeason = { week: season.current_week, pickCycle: season.pick_cycle, stateVersion: season.state_version };
    const afterSeason = { ...beforeSeason, pickCycle: 2, stateVersion: season.state_version + 1 };
    const targets = [{ targetType: "LEAGUE_SEASON", targetId: season.id, beforeState: beforeSeason, afterState: afterSeason, stateVersion: afterSeason.stateVersion }];
    for (const track of tracks) {
      const beforeTrack = repairTrackState(track);
      const change = plan.trackChanges.find((candidate) => candidate.trackId === track.id);
      const afterTrack = { ...beforeTrack, usedPicks: change.usedPicks, availablePicks: change.availablePicks, stateVersion: beforeTrack.stateVersion + 1 };
      targets.push({ targetType: "TRACK", targetId: track.id, beforeState: beforeTrack, afterState: afterTrack, stateVersion: afterTrack.stateVersion });
    }
    return {
      normalizedIntent: {},
      description: `Reset ${tracks.length} Track Pick pool${tracks.length === 1 ? "" : "s"} for the ${season.year} NFL playoffs`,
      warnings: ["This action is non-undoable.", "After cycle 2 begins, recovery requires a forward application fix."],
      leagueSeason: season,
      targets,
      plan: { season, tracks, trackChanges: plan.trackChanges },
      undoable: false,
    };
  }

  if (action !== "DELETE_USER") throw new NotFoundError("Admin action not found");
  const userId = positiveId(input.userId, "User ID");
  const user = await User.findByPk(userId, { attributes: ["id"], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!user) throw new NotFoundError("User not found");
  const tracks = await Track.findAll({ where: { user_id: userId }, attributes: ["id", "league_season_id", "state_version"], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
  return { normalizedIntent: { userId }, description: `Permanently delete User ${userId} and ${tracks.length} owned Tracks`, warnings: ["This action cannot be undone."], leagueSeason: null, targets: [{ targetType: "USER", targetId: userId, beforeState: { exists: true }, afterState: null }, ...tracks.map((track) => ({ targetType: "TRACK", targetId: track.id, beforeState: trackState(track), afterState: null }))] };
}

function publicPreview(action, built, expiresAt, confirmationKey) {
  return { action, description: built.description, warnings: built.warnings, leagueSeason: built.leagueSeason ? { id: built.leagueSeason.id, year: built.leagueSeason.year, week: built.leagueSeason.current_week } : null, affectedIds: built.targets.map(({ targetType, targetId }) => ({ targetType, targetId })), targets: built.targets, ...(built.unfinishedUnselectedGames ? { unfinishedUnselectedGames: built.unfinishedUnselectedGames } : {}), expiresAt, confirmationKey, undoable: Boolean(built.undoable) };
}

async function createPreview(action, input, options = {}) {
  return sequelize.transaction(async (transaction) => {
    const built = await buildActionPreview(action, input || {}, transaction, false, options);
    const confirmationKey = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS);
    const preview = publicPreview(action, built, expiresAt, confirmationKey);
    const stored = { ...preview };
    delete stored.confirmationKey;
    await AdminActionPreview.create({ confirmation_key_hash: hashKey(confirmationKey), action, normalized_intent: built.normalizedIntent, preview: stored, league_season_id: built.leagueSeason?.id || null, week: built.leagueSeason?.current_week ?? null, league_season_state_version: built.leagueSeason?.state_version ?? null, schedule_hash: built.scheduleHash || null, expires_at: expiresAt }, { transaction });
    return preview;
  });
}

async function confirmPreview(action, confirmationKey, note, options = {}) {
  if (typeof confirmationKey !== "string" || !/^[a-f0-9]{64}$/.test(confirmationKey)) throw new ValidationError("A valid confirmation key is required");
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
    const stored = await AdminActionPreview.findOne({ where: { confirmation_key_hash: hashKey(confirmationKey) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!stored || stored.action !== action) throw new NotFoundError("Admin action preview not found");
    if (stored.audit_operation_id) return AdminAuditOperation.findByPk(stored.audit_operation_id, { include: [{ model: AdminAuditTarget, as: "targets" }], transaction });
    if (stored.expires_at <= new Date()) throw new ConflictError("Admin action preview expired");
    const built = await buildActionPreview(action, stored.normalized_intent, transaction, true, options);
    const expected = stored.preview.targets.map(({ targetType, targetId, beforeState }) => ({ targetType, targetId, beforeState }));
    const actual = built.targets.map(({ targetType, targetId, beforeState }) => ({ targetType, targetId, beforeState }));
    if (!isDeepStrictEqual(actual, expected) || (stored.league_season_state_version ?? null) !== (built.leagueSeason?.state_version ?? null)) throw new ConflictError("Admin action preview is stale");
    if ((stored.schedule_hash || null) !== (built.scheduleHash || null)) throw new ConflictError("Admin action preview schedule is stale");
    if (!isDeepStrictEqual(stored.normalized_intent, built.normalizedIntent)) throw new ConflictError("Admin action preview result state is stale");

    if (action === "RESET_CURRENT_PICKS" && built.normalizedIntent.scope === "ALL"
      && options.confirmationPhrase !== "RESET EVERY TRACK") {
      throw new ValidationError("Type RESET EVERY TRACK to confirm the league-wide reset");
    }
    if (action === "RESET_PLAYOFF_PICK_POOLS" && options.confirmationPhrase !== "RESET PICKS FOR PLAYOFFS") {
      throw new ValidationError("Type RESET PICKS FOR PLAYOFFS to confirm the playoff Pick reset");
    }

    if (built.existingAuditOperationId) {
      await stored.update({ consumed_at: new Date(), audit_operation_id: built.existingAuditOperationId }, { transaction });
      return AdminAuditOperation.findByPk(built.existingAuditOperationId, { include: [{ model: AdminAuditTarget, as: "targets" }], transaction });
    }

    if (action === "CLOSE_WEEK") {
      const requiredNote = normalizeNote(note);
      if (!requiredNote) throw new ValidationError("A note is required for manual week closure");
      const result = await closeWeek({ ...built.normalizedIntent, mode: "MANUAL", adminNote: requiredNote, transaction });
      if (result.status === "ALREADY_COMPLETED") return result;
      await stored.update({ consumed_at: new Date(), audit_operation_id: result.auditOperationId }, { transaction });
      return AdminAuditOperation.findByPk(result.auditOperationId, { include: [{ model: AdminAuditTarget, as: "targets" }], transaction });
    }

    let targets = built.targets;
    if (action === "ADD_USER_WIN") {
      const user = await User.findByPk(built.normalizedIntent.userId, { transaction, lock: transaction.LOCK.UPDATE });
      await user.addWin(built.normalizedIntent.year, built.normalizedIntent.wonWithTie, { transaction });
      targets = [{ ...built.targets[0], afterState: { userRecord: user.user_record, crownType: user.getCrownType() } }];
    } else if (action === "CREATE_TRACK") {
      const teams = await Team.findAll({ attributes: ["team_name"], transaction });
      const track = await Track.create({ user_id: built.normalizedIntent.userId, league_season_id: built.leagueSeason.id, available_picks: teams.map((team) => team.team_name), used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 }, { transaction });
      targets = [{ targetType: "TRACK", targetId: track.id, beforeState: null, afterState: trackState(track), stateVersion: 0 }];
    } else if (action === "DELETE_TRACK") {
      await Track.destroy({ where: { id: built.normalizedIntent.trackId }, transaction });
    } else if (action === "DELETE_USER") {
      await Track.destroy({ where: { user_id: built.normalizedIntent.userId }, transaction });
      await User.destroy({ where: { id: built.normalizedIntent.userId }, transaction });
    } else if (action === "RESET_CURRENT_PICKS") {
      for (const { track, pick, plan } of built.plans) {
        await pick.destroy({ transaction });
        await track.update({ current_pick: plan.trackAfter.currentPick, used_picks: plan.trackAfter.usedPicks, available_picks: plan.trackAfter.availablePicks, state_version: track.state_version + 1 }, { transaction });
      }
    } else if (action === "ASSIGN_CURRENT_PICK") {
      const assigned = await Pick.create({
        track_id: built.plan.track.id,
        league_season_id: built.leagueSeason.id,
        week: built.plan.pick.week,
        pick_cycle: built.plan.pick.pickCycle,
        team_name: built.plan.pick.teamName,
        origin: built.plan.pick.origin,
        outcome: built.plan.pick.outcome,
        committed_at: new Date(),
        schedule_hash: built.plan.scheduleHash,
        state_version: 0,
      }, { transaction });
      await built.plan.track.update({ current_pick: built.plan.trackAfter.currentPick, used_picks: built.plan.trackAfter.usedPicks, available_picks: built.plan.trackAfter.availablePicks, state_version: built.plan.track.state_version + 1 }, { transaction });
      targets = [...built.targets, { targetType: "PICK", targetId: assigned.id, beforeState: null, afterState: repairPickState(assigned), stateVersion: assigned.state_version }];
    } else if (action === "REPLACE_CURRENT_PICK") {
      await built.plan.pick.update({ team_name: built.plan.pickAfter.teamName, origin: built.plan.pickAfter.origin, pick_cycle: built.plan.pickAfter.pickCycle, state_version: built.plan.pick.state_version + 1 }, { transaction });
      await built.plan.track.update({ current_pick: built.plan.trackAfter.currentPick, used_picks: built.plan.trackAfter.usedPicks, available_picks: built.plan.trackAfter.availablePicks, state_version: built.plan.track.state_version + 1 }, { transaction });
    } else if (action === "REACTIVATE_TRACK") {
      await built.plan.track.update({ eliminated_by_pick_id: null, wrong_pick: null, state_version: built.plan.track.state_version + 1 }, { transaction });
    } else if (action === "RESET_PLAYOFF_PICK_POOLS") {
      await built.plan.season.update({ pick_cycle: 2, state_version: built.plan.season.state_version + 1 }, { transaction });
      for (const track of built.plan.tracks) {
        const change = built.plan.trackChanges.find((candidate) => candidate.trackId === track.id);
        await track.update({ used_picks: change.usedPicks, available_picks: change.availablePicks, state_version: track.state_version + 1 }, { transaction });
      }
    }

    const auditNote = action === "OVERRIDE_GAME_RESULT" ? built.normalizedIntent.explanation : normalizeNote(note);
    const operation = await AdminAuditOperation.create({ action, description: built.description, note: auditNote, status: "COMMITTED", league_season_id: built.leagueSeason?.id || null, week: built.leagueSeason?.current_week ?? null, summary: { affectedCount: targets.length }, undoable: Boolean(built.undoable) }, { transaction });
    if (action === "OVERRIDE_GAME_RESULT") {
      const intent = built.normalizedIntent;
      await OfficialGameResultOverride.create({ league_season_id: built.leagueSeason.id, week: built.leagueSeason.current_week, matchup_key: matchupKey(intent.homeTeam, intent.awayTeam), home_team: intent.homeTeam, away_team: intent.awayTeam, home_score: intent.homeScore, away_score: intent.awayScore, winner_team: intent.winnerTeam, loser_team: intent.loserTeam, tied: intent.tied, schedule_hash: intent.scheduleHash, explanation: intent.explanation, source_url: intent.sourceUrl, admin_audit_operation_id: operation.id, created_at: new Date() }, { transaction });
    } else if (action === "REACTIVATE_TRACK") {
      await TrackReactivation.create({ track_id: built.plan.track.id, league_season_id: built.leagueSeason.id, waived_pick_id: built.plan.waivedPickId, admin_audit_operation_id: operation.id, created_at: new Date() }, { transaction });
    }
    await AdminAuditTarget.bulkCreate(targets.map((target) => ({ admin_audit_operation_id: operation.id, target_type: target.targetType, target_id: target.targetId, before_state: target.beforeState, after_state: target.afterState, state_version: target.stateVersion ?? target.afterState?.stateVersion ?? null })), { transaction });
    await stored.update({ consumed_at: new Date(), audit_operation_id: operation.id }, { transaction });
    return AdminAuditOperation.findByPk(operation.id, { include: [{ model: AdminAuditTarget, as: "targets" }], transaction });
  });
}

module.exports = { PREVIEW_TTL_MS, confirmPreview, createPreview, hashKey };
