const crypto = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { Op, Transaction } = require("sequelize");
const {
  sequelize,
  User,
  Track,
  Pick,
  TrackReactivation,
  BuybackDecision,
  Team,
  LeagueSeason,
  LeagueWeekOperation,
  ScheduleSnapshot,
  OfficialGameResultOverride,
  AdminActionPreview,
  AdminAuditOperation,
  AdminAuditTarget,
  FeatureRelease,
  UserFeatureEntitlement,
  UserFeatureAccessState,
  FeatureAdminAuditTarget,
  ReminderCampaign,
} = require("../../models");
const { ConflictError, NotFoundError, ValidationError } = require("../lib/errors");
const { getAdminAction } = require("./action-registry");
const { closeWeek } = require("../modules/week-closure/week-closure-service");
const { planAssignCurrentPick, planBuybackReactivation, planHistoricalPickCorrection, planOutcomeReconciliation, planPlayoffPoolReset, planReplaceCurrentPick, planResetCurrentPick, planTrackProjection } = require("../modules/admin-repairs/repair-policy");
const { buildRolloverExport, deriveWinningUsers, normalizeTargetYear, normalizeWinnerTrackIds } = require("../modules/league-season/completion-rollover-policy");
const { earliestScheduleKickoff, isTrackEnrollmentOpen } = require("../modules/league-season/enrollment-policy");
const { inferPreseasonWeek } = require("../modules/league-season/preseason-policy");
const { PICK_REMINDERS, graceState } = require("../features/feature-access-service");
const { createCampaignWithDeliveries } = require("../modules/reminders/reminder-repository");

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
  committedAt: pick.committed_at?.toISOString?.() || pick.committed_at,
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

const historicalActions = new Set(["CORRECT_HISTORICAL_PICK", "RECONCILE_PICK_OUTCOME"]);
async function prepareActionOptions(action, input, options) {
  if (action === "SEND_PICK_REMINDERS") {
    if (typeof options.loadManualReminderContext !== "function") throw new ConflictError("Pick Reminders manual campaigns are unavailable");
    return { ...options, manualReminderContext: await options.loadManualReminderContext() };
  }
  if (action === "CLOSE_WEEK") {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1 } });
    if (season?.schedule_phase === "PRESEASON" && typeof options.loadPreseasonWeeks === "function") {
      const weeks = await options.loadPreseasonWeeks({ year: season.year, now: new Date() });
      return { ...options, nextPreseasonWeek: inferPreseasonWeek(weeks.filter((item) => item.week > season.current_week)) };
    }
  }
  if (action === "ENABLE_PRESEASON") {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1 } });
    if (!season) throw new ConflictError("No open League Season exists");
    if (typeof options.loadPreseasonWeeks !== "function" || typeof options.loadRolloverTargetSchedule !== "function") throw new ConflictError("NFL schedule validation is required");
    const now = typeof options.now === "function" ? options.now() : options.now || new Date();
    const [preseasonWeeks, regularSchedule] = await Promise.all([
      options.loadPreseasonWeeks({ year: season.year, now }),
      options.loadRolloverTargetSchedule({ year: season.year, week: 1 }),
    ]);
    return { ...options, preseasonWeeks, regularSchedule, now };
  }
  if (action === "START_REGULAR_SEASON") {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1 } });
    if (!season) throw new ConflictError("No open League Season exists");
    if (typeof options.loadRolloverTargetSchedule !== "function") throw new ConflictError("Week 1 schedule validation is required");
    return { ...options, regularSchedule: await options.loadRolloverTargetSchedule({ year: season.year, week: 1 }) };
  }
  if (action === "START_LEAGUE_SEASON") {
    const year = Number(input.year);
    if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new ValidationError("A four-digit League Season year is required");
    if (typeof options.loadRolloverTargetSchedule !== "function") throw new ConflictError("Week 1 Fixture validation is required");
    const startSchedule = await options.loadRolloverTargetSchedule({ year, week: 1 });
    if (!startSchedule || startSchedule.year !== year || startSchedule.week !== 1 || !startSchedule.contentHash || !startSchedule.normalizedSchedule) throw new ConflictError("Week 1 Fixture validation failed");
    return { ...options, startSchedule };
  }
  if (action === "ROLLOVER_LEAGUE_SEASON") {
    const targetYear = normalizeTargetYear(input.targetYear);
    if (typeof options.loadRolloverTargetSchedule !== "function") throw new ConflictError("Target-year Fixture validation is required");
    const targetSchedule = await options.loadRolloverTargetSchedule({ year: targetYear, week: 1 });
    if (!targetSchedule || targetSchedule.year !== targetYear || targetSchedule.week !== 1) throw new ConflictError("Target-year Fixture validation failed");
    return { ...options, targetSchedule };
  }
  if (!historicalActions.has(action)) return options;
  if (typeof options.loadHistoricalResults !== "function") throw new ConflictError("Authoritative historical results are required");
  const season = await LeagueSeason.findOne({ where: { open_slot: 1 } });
  if (!season) throw new ConflictError("No open League Season exists");
  let week = Number(input.week);
  if (action === "CORRECT_HISTORICAL_PICK") {
    const pick = await Pick.findByPk(positiveId(input.pickId, "Pick ID"), { attributes: ["week", "league_season_id"] });
    if (!pick || pick.league_season_id !== season.id) throw new NotFoundError("Pick not found");
    week = pick.week;
  }
  if (!Number.isInteger(week) || week < 1 || week >= season.current_week) throw new ValidationError("A closed historical week is required");
  const historicalResultsContext = await options.loadHistoricalResults({ leagueSeasonId: season.id, year: season.year, week });
  return { ...options, historicalResultsContext };
}

async function projectionPlan({ season, track, picks, transaction }) {
  const [teams, reactivations] = await Promise.all([
    Team.findAll({ attributes: ["team_name"], order: [["id", "ASC"]], transaction }),
    TrackReactivation.findAll({ where: { track_id: track.id }, attributes: ["waived_pick_id"], transaction }),
  ]);
  return planTrackProjection({
    season: { state: season.state, currentWeek: season.current_week, pickCycle: season.pick_cycle },
    picks: picks.map((pick) => ({ id: pick.id, week: pick.week, pickCycle: pick.pick_cycle, teamName: pick.team_name, outcome: pick.outcome })),
    waivedPickIds: reactivations.map((item) => item.waived_pick_id),
    teamNames: teams.map((team) => team.team_name),
  });
}

function matchesRecordedState(current, recorded) {
  if (current === null || recorded === null) return current === recorded;
  return Object.entries(recorded).every(([key, value]) => isDeepStrictEqual(current[key], value));
}

function trackWriteState(state) {
  return { current_pick: state.currentPick, used_picks: state.usedPicks, available_picks: state.availablePicks, wrong_pick: state.wrongPick, eliminated_by_pick_id: state.eliminatedByPickId, state_version: state.stateVersion };
}

function pickWriteState(state) {
  return { track_id: state.trackId, league_season_id: state.leagueSeasonId, week: state.week, pick_cycle: state.pickCycle, team_name: state.teamName, origin: state.origin, outcome: state.outcome, schedule_hash: state.scheduleHash, state_version: state.stateVersion, committed_at: state.committedAt ? new Date(state.committedAt) : new Date() };
}

async function clearSeasonGameplay(leagueSeasonId, transaction) {
  await BuybackDecision.destroy({ where: { league_season_id: leagueSeasonId }, transaction });
  await TrackReactivation.destroy({ where: { league_season_id: leagueSeasonId }, transaction });
  await OfficialGameResultOverride.destroy({ where: { league_season_id: leagueSeasonId }, transaction });
  await Pick.destroy({ where: { league_season_id: leagueSeasonId }, transaction });
  await Track.destroy({ where: { league_season_id: leagueSeasonId }, transaction });
  await LeagueWeekOperation.destroy({ where: { league_season_id: leagueSeasonId }, transaction });
  await ScheduleSnapshot.destroy({ where: { league_season_id: leagueSeasonId }, transaction });
}

async function buildActionPreview(action, input, transaction, lock = false, options = {}) {
  const { manualClosureContext, historicalResultsContext } = options;
  if (!getAdminAction(action)) throw new NotFoundError("Admin action not found");
  if (action === "SET_PICK_REMINDERS_BETA_ACCESS") {
    const userId = positiveId(input.userId, "User ID");
    if (typeof input.enabled !== "boolean") throw new ValidationError("Enabled must be a boolean");
    const user = await User.findByPk(userId, { attributes: ["id"], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!user) throw new NotFoundError("User not found");
    const entitlement = await UserFeatureEntitlement.findOne({ where: { user_id: userId, feature_key: PICK_REMINDERS }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    const before = { feature: PICK_REMINDERS, enabled: entitlement?.enabled === true, stateVersion: entitlement?.state_version || 0 };
    if (before.enabled === input.enabled) throw new ConflictError("Pick Reminders Beta Access is already in the requested state");
    const grace = !input.enabled ? graceState(options.now || new Date()) : null;
    return { normalizedIntent: { userId, enabled: input.enabled }, description: `${input.enabled ? "Grant" : "Remove"} Pick Reminders Beta Access for User ${userId}`, warnings: ["Access does not change reminder consent."], leagueSeason: null, targets: [{ targetType: "USER", targetId: userId, beforeState: before, afterState: { ...before, enabled: input.enabled, stateVersion: before.stateVersion + 1, ...(grace ? { accessRemovedAt: grace.access_removed_at, graceExpiresAt: grace.grace_expires_at } : {}) } }], plan: { entitlement, grace }, undoable: false };
  }
  if (action === "SET_PICK_REMINDERS_PUBLIC_RELEASE") {
    if (typeof input.enabled !== "boolean") throw new ValidationError("Enabled must be a boolean");
    if (input.enabled && options.releaseReadiness?.ready !== true) throw new ConflictError("Pick Reminders are not ready for public release");
    const release = await FeatureRelease.findByPk(PICK_REMINDERS, { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!release) throw new ConflictError("Pick Reminders feature registration is unavailable");
    const before = { feature: PICK_REMINDERS, publicReleased: release.public_released, stateVersion: release.state_version };
    if (before.publicReleased === input.enabled) throw new ConflictError("Pick Reminders public release is already in the requested state");
    const grace = !input.enabled ? graceState(options.now || new Date()) : null;
    return { normalizedIntent: { enabled: input.enabled }, description: `${input.enabled ? "Release" : "Withdraw"} Pick Reminders ${input.enabled ? "to" : "from"} all Users`, warnings: ["Release does not change reminder consent."], leagueSeason: null, targets: [{ targetType: "FEATURE", targetId: PICK_REMINDERS, beforeState: before, afterState: { ...before, publicReleased: input.enabled, stateVersion: before.stateVersion + 1, ...(grace ? { accessRemovedAt: grace.access_removed_at, graceExpiresAt: grace.grace_expires_at } : {}) } }], plan: { release, grace }, undoable: false };
  }
  if (action === "SEND_PICK_REMINDERS") {
    if (!input || Object.keys(input).length !== 0) throw new ValidationError("Manual Pick Reminders accepts no campaign input");
    const context = await options.loadManualReminderContext({ transaction });
    const season = await LeagueSeason.findByPk(context.season.id, { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!season || season.open_slot !== 1 || season.state !== "ACTIVE" || season.current_week !== context.season.current_week || season.schedule_phase !== context.season.schedule_phase) throw new ConflictError("Manual Pick Reminders context is stale");
    const existing = await ReminderCampaign.findOne({ where: { league_season_id: season.id, schedule_phase: season.schedule_phase, round: season.current_week, kind: "MANUAL", window_key: "ONE_PER_ROUND_V1" }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (existing) throw new ConflictError("The manual Pick Reminders campaign already exists for this round");
    const deadline = new Date(context.deadline);
    const beforeState = { exists: false, stateVersion: season.state_version, deadline: deadline.toISOString(), email: context.counts.email, push: context.counts.push };
    return {
      normalizedIntent: {}, description: `Send the manual Pick Reminders campaign for ${season.year} round ${season.current_week}`,
      warnings: context.warnings, leagueSeason: season, scheduleHash: context.scheduleHash,
      targets: [{ targetType: "LEAGUE_SEASON", targetId: season.id, beforeState, afterState: { ...beforeState, exists: true } }],
      publicFields: { leagueSeason: { year: season.year }, round: season.current_week, schedulePhase: season.schedule_phase, authoritativeDeadline: deadline.toISOString(), eligibleDeliveries: context.counts },
      plan: { deadline, currentTime: context.currentTime, evaluated: context.evaluated, deliveries: context.deliveries }, undoable: false,
    };
  }
  if (action === "CREATE_LEAGUE_SEASON") {
    const year = Number(input.year);
    if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new ValidationError("A four-digit League Season year is required");
    if (await LeagueSeason.findOne({ where: { open_slot: 1 }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) })) throw new ConflictError("An open League Season already exists");
    if (await LeagueSeason.findOne({ where: { year }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) })) throw new ConflictError("That League Season year already exists");
    if (await Track.count({ where: { league_season_id: null }, transaction })) throw new ConflictError("Unassigned legacy Tracks must be handled with the guarded bootstrap command");
    return { normalizedIntent: { year }, description: `Create the ${year} League Season at Week 0`, warnings: [], leagueSeason: null, targets: [{ targetType: "LEAGUE_SEASON", targetId: year, beforeState: null, afterState: { year, state: "SETUP", week: 0, stateVersion: 0 } }], plan: { year }, undoable: false };
  }
  if (action === "START_LEAGUE_SEASON") {
    const season = await openSeason(transaction, lock);
    const year = Number(input.year);
    if (season.year !== year || season.state !== "SETUP" || season.current_week !== 0) throw new ConflictError("Only a SETUP League Season at Week 0 can start Week 1");
    const schedule = options.startSchedule;
    const earliestKickoff = new Date(schedule?.earliestKickoff || earliestScheduleKickoff({ normalized_schedule: schedule?.normalizedSchedule }));
    const now = typeof options.now === "function" ? options.now() : options.now || new Date();
    if (!schedule || Number.isNaN(earliestKickoff.getTime())) throw new ConflictError("A valid Week 1 schedule is required");
    if (earliestKickoff <= now) throw new ConflictError("Week 1 cannot start after its earliest kickoff");
    const [userCount, trackCount] = await Promise.all([User.count({ transaction }), Track.count({ where: { league_season_id: season.id }, transaction })]);
    return { normalizedIntent: { year }, description: `Start Week 1 for ${year} with ${userCount} Users and ${trackCount} Tracks`, warnings: [], leagueSeason: season, scheduleHash: schedule.contentHash, targets: [{ targetType: "LEAGUE_SEASON", targetId: season.id, beforeState: { year, state: season.state, week: season.current_week, stateVersion: season.state_version, userCount, trackCount }, afterState: { year, state: "ACTIVE", week: 1, stateVersion: season.state_version + 1, userCount, trackCount } }], plan: { season, schedule }, undoable: false };
  }
  if (action === "ENABLE_PRESEASON") {
    const season = await openSeason(transaction, lock);
    if (!((season.state === "SETUP" && season.current_week === 0) || (season.state === "ACTIVE" && season.schedule_phase === "REGULAR" && season.current_week === 1))) throw new ConflictError("Preseason can be enabled only before regular Week 1 advances");
    const now = options.now || new Date();
    const regularKickoff = new Date(options.regularSchedule?.earliestKickoff);
    if (Number.isNaN(regularKickoff.getTime()) || now >= regularKickoff) throw new ConflictError("Preseason cannot be enabled after regular Week 1 begins");
    const preseasonWeek = inferPreseasonWeek(options.preseasonWeeks);
    if (!preseasonWeek) throw new ConflictError("No unfinished preseason week is available");
    const trackCount = await Track.count({ where: { league_season_id: season.id }, transaction });
    return { normalizedIntent: { year: season.year, preseasonWeek }, description: `Delete ${trackCount} Tracks and enable preseason Week ${preseasonWeek}`, warnings: ["All current-season Tracks and gameplay data will be permanently deleted."], leagueSeason: season, targets: [{ targetType: "LEAGUE_SEASON", targetId: season.id, beforeState: { phase: season.schedule_phase, week: season.current_week, stateVersion: season.state_version, trackCount }, afterState: { phase: "PRESEASON", week: preseasonWeek, stateVersion: season.state_version + 1, trackCount: 0 } }], plan: { season, preseasonWeek }, undoable: false };
  }
  if (action === "START_REGULAR_SEASON") {
    const season = await openSeason(transaction, lock);
    if (season.state !== "ACTIVE" || season.schedule_phase !== "PRESEASON") throw new ConflictError("The League Season is not in preseason mode");
    const trackCount = await Track.count({ where: { league_season_id: season.id }, transaction });
    const now = typeof options.now === "function" ? options.now() : options.now || new Date();
    const regularKickoff = new Date(options.regularSchedule?.earliestKickoff);
    if (Number.isNaN(regularKickoff.getTime())) throw new ConflictError("A valid regular Week 1 schedule is required");
    const late = now >= regularKickoff;
    return { normalizedIntent: { year: season.year }, description: `Delete ${trackCount} preseason Tracks and start regular Week 1`, warnings: ["All preseason Tracks and gameplay data will be permanently deleted."], leagueSeason: season, scheduleHash: options.regularSchedule.contentHash, targets: [{ targetType: "LEAGUE_SEASON", targetId: season.id, beforeState: { phase: "PRESEASON", week: season.current_week, stateVersion: season.state_version, trackCount }, afterState: { phase: "REGULAR", week: 1, stateVersion: season.state_version + 1, trackCount: 0, lateWeekOneEnrollment: late } }], plan: { season, schedule: options.regularSchedule, late }, undoable: false };
  }
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
    const schedule = season.current_week === 1 ? await ScheduleSnapshot.findOne({ where: { league_season_id: season.id, week: 1 }, order: [["fetched_at", "DESC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }) : null;
    const now = typeof options.now === "function" ? options.now() : options.now || new Date();
    if (!isTrackEnrollmentOpen({ season, earliestKickoff: earliestScheduleKickoff(schedule), now })) throw new ConflictError("Track enrollment is closed");
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
    const schedule = await ScheduleSnapshot.findOne({ where: { league_season_id: season.id, week: season.current_week, provider: season.schedule_phase === "PRESEASON" ? "ESPN" : "FIXTURE_DOWNLOAD" }, order: [["fetched_at", "DESC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
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
    const nextWeek = season.schedule_phase === "PRESEASON" ? options.nextPreseasonWeek : season.current_week < 22 ? season.current_week + 1 : 22;
    return {
      normalizedIntent: { leagueSeasonId: season.id, week: season.current_week, scheduleHash: context.scheduleHash, games: context.games, unfinishedUnselectedGames: context.unfinishedUnselectedGames, nextWeek },
      description: `Manually close Week ${season.current_week} of the ${season.year} League Season`,
      warnings: context.unfinishedUnselectedGames.length ? ["Unfinished unselected games will not reopen this week."] : [],
      unfinishedUnselectedGames: context.unfinishedUnselectedGames,
      leagueSeason: season,
      scheduleHash: context.scheduleHash,
      targets: [{ targetType: "LEAGUE_SEASON", targetId: season.id, beforeState: { week: season.current_week, stateVersion: season.state_version }, afterState: { week: nextWeek || season.current_week, preseasonComplete: !nextWeek, stateVersion: season.state_version + 1 } }],
    };
  }

  if (action === "COMPLETE_LEAGUE_SEASON") {
    const season = await openSeason(transaction, lock);
    if (season.state !== "ACTIVE") throw new ConflictError("Only an active League Season can be completed");
    const winnerTrackIds = normalizeWinnerTrackIds(input.winnerTrackIds);
    const [lastClosure, currentPicks, pendingCurrentPicks, currentAutoPick, winnerTracks] = await Promise.all([
      LeagueWeekOperation.findOne({ where: { league_season_id: season.id, phase: "CLOSE_WEEK" }, order: [["week", "DESC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }),
      Pick.count({ where: { league_season_id: season.id, week: season.current_week }, transaction }),
      Pick.count({ where: { league_season_id: season.id, week: season.current_week, outcome: "PENDING" }, transaction }),
      LeagueWeekOperation.findOne({ where: { league_season_id: season.id, week: season.current_week, phase: "AUTO_PICK" }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }),
      Track.findAll({ where: { id: { [Op.in]: winnerTrackIds }, league_season_id: season.id }, order: [["id", "ASC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }),
    ]);
    if (!lastClosure || pendingCurrentPicks || (lastClosure.week < season.current_week && (currentPicks || currentAutoPick))) throw new ConflictError("The League Season can be completed only after a closed week and before the next week begins");
    if (winnerTracks.length !== winnerTrackIds.length) throw new ValidationError("Every winning Track must belong to the current League Season");
    const winners = deriveWinningUsers(winnerTracks);
    const users = await User.findAll({ where: { id: { [Op.in]: winners.userIds } }, order: [["id", "ASC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    const targets = [{ targetType: "LEAGUE_SEASON", targetId: season.id, beforeState: { state: season.state, stateVersion: season.state_version }, afterState: { state: "COMPLETE", stateVersion: season.state_version + 1 } }];
    for (const user of users) {
      const before = userWinState(user);
      const record = before.userRecord.some((item) => Number(item.year) === season.year)
        ? before.userRecord.map((item) => Number(item.year) === season.year ? { ...item, won: true, won_with_tie: Boolean(item.won_with_tie || winners.wonWithTie) } : item)
        : [...before.userRecord, { year: season.year, won: true, won_with_tie: winners.wonWithTie }];
      targets.push({ targetType: "USER", targetId: user.id, beforeState: before, afterState: { userRecord: record } });
    }
    return { normalizedIntent: { winnerTrackIds }, description: `Complete the ${season.year} League Season with ${winners.userIds.length} winning User${winners.userIds.length === 1 ? "" : "s"}`, warnings: ["Completion is non-undoable."], leagueSeason: season, targets, plan: { season, users, winners }, undoable: false };
  }

  if (action === "ROLLOVER_LEAGUE_SEASON") {
    const targetYear = normalizeTargetYear(input.targetYear);
    const season = await LeagueSeason.findOne({ where: { state: "COMPLETE" }, order: [["id", "DESC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!season) throw new ConflictError("A completed League Season is required");
    if (await LeagueSeason.count({ where: { year: targetYear }, transaction })) throw new ConflictError("The target League Season year already exists");
    if (!options.targetSchedule || options.targetSchedule.year !== targetYear) throw new ConflictError("Target-year Fixture validation failed");
    const [tracks, picks] = await Promise.all([
      Track.findAll({ where: { league_season_id: season.id }, order: [["id", "ASC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }),
      Pick.findAll({ where: { league_season_id: season.id }, order: [["id", "ASC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }),
    ]);
    const exported = buildRolloverExport({ season, tracks, picks });
    return { normalizedIntent: { targetYear: String(targetYear) }, description: `Roll the ${season.year} League Season into ${targetYear} Week 0`, warnings: [`Permanently delete ${tracks.length} Tracks and ${picks.length} Picks.`], leagueSeason: season, scheduleHash: exported.exportChecksum, rolloverExport: exported, targets: [{ targetType: "LEAGUE_SEASON", targetId: season.id, beforeState: { state: season.state, stateVersion: season.state_version, trackCount: tracks.length, pickCount: picks.length }, afterState: { state: "ROLLED_OVER", stateVersion: season.state_version + 1, successorYear: targetYear } }], plan: { season, tracks, picks, targetYear }, undoable: false };
  }

  if (action === "UNDO_ADMIN_ACTION") {
    const operationId = positiveId(input.operationId, "Operation ID");
    const operation = await AdminAuditOperation.findByPk(operationId, { include: [{ model: AdminAuditTarget, as: "targets" }], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!operation) throw new NotFoundError("Admin operation not found");
    if (!operation.undoable) throw new ConflictError("This admin operation is not undoable");
    if (operation.status !== "COMMITTED" || operation.undone_by_operation_id) throw new ConflictError("This admin operation was already undone");
    const loadedTargets = [];
    for (const target of operation.targets) {
      let model = null;
      let current = null;
      if (target.target_type === "TRACK") {
        model = await Track.findByPk(target.target_id, { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
        current = model ? repairTrackState(model) : null;
      } else if (target.target_type === "PICK") {
        model = await Pick.findByPk(target.target_id, { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
        current = model ? repairPickState(model) : null;
      } else throw new ConflictError("This admin operation has an unsupported undo target");
      if (!matchesRecordedState(current, target.after_state)) throw new ConflictError("Admin operation target state changed after commit");
      const restored = target.before_state === null ? null : {
        ...target.before_state,
        stateVersion: (current?.stateVersion ?? target.before_state.stateVersion ?? 0) + 1,
      };
      loadedTargets.push({ target, model, current, restored });
    }
    if (operation.action === "REACTIVATE_TRACK") {
      const event = await TrackReactivation.findOne({ where: { admin_audit_operation_id: operation.id }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
      if (!event) throw new ConflictError("Admin operation target state changed after commit");
    }
    const season = operation.league_season_id ? await LeagueSeason.findByPk(operation.league_season_id, { transaction }) : null;
    return { normalizedIntent: { operationId }, description: `Undo ${operation.action} operation ${operation.id}`, warnings: ["Undo is one-level and cannot be redone."], leagueSeason: season, targets: loadedTargets.map(({ target, current, restored }) => ({ targetType: target.target_type, targetId: target.target_id, beforeState: current, afterState: restored, stateVersion: restored?.stateVersion ?? null })), plan: { operation, loadedTargets }, undoable: false };
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
    const schedule = await ScheduleSnapshot.findOne({ where: { league_season_id: season.id, week: season.current_week, provider: season.schedule_phase === "PRESEASON" ? "ESPN" : "FIXTURE_DOWNLOAD" }, order: [["fetched_at", "DESC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
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
    const schedule = await ScheduleSnapshot.findOne({ where: { league_season_id: season.id, week: season.current_week, provider: season.schedule_phase === "PRESEASON" ? "ESPN" : "FIXTURE_DOWNLOAD" }, order: [["fetched_at", "DESC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
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
    const correctionNote = cleanText(input.correctionNote, "Correction note", 500);
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
      normalizedIntent: { trackId, paymentConfirmed: true, correctionNote },
      description: `Reactivate Track ${trackId} after buyback while preserving Week ${eliminatingPick.week} Wrong Pick ${eliminatingPick.team_name}`,
      warnings: ["League policy intends buyback for Week 1 only.", "Payment confirmation occurs outside the application and no payment data is stored."],
      leagueSeason: season,
      targets: [{ targetType: "TRACK", targetId: track.id, beforeState: beforeTrack, afterState: afterTrack, stateVersion: afterTrack.stateVersion }],
      plan: { track, waivedPickId: plan.waivedPickId, trackAfter: plan.trackAfter },
      undoable: true,
    };
  }

  if (action === "CORRECT_HISTORICAL_PICK") {
    const season = await openSeason(transaction, lock);
    const pickId = positiveId(input.pickId, "Pick ID");
    const teamName = cleanText(input.teamName, "Team", 255);
    const pick = await Pick.findOne({ where: { id: pickId, league_season_id: season.id }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!pick || pick.week >= season.current_week || pick.outcome === "PENDING") throw new ConflictError("A settled historical Pick is required");
    const track = await Track.findByPk(pick.track_id, { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    const picks = await Pick.findAll({ where: { track_id: track.id, league_season_id: season.id }, order: [["pick_cycle", "ASC"], ["week", "ASC"], ["id", "ASC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (picks.some((item) => item.id !== pick.id && item.pick_cycle === pick.pick_cycle && item.team_name === teamName)) throw new ConflictError("Team was already used in this Pick cycle");
    const historicalContext = historicalResultsContext;
    if (!historicalContext || historicalContext.week !== pick.week) throw new ConflictError("Authoritative historical results are required");
    let correction;
    try {
      correction = planHistoricalPickCorrection({
        pick: { id: pick.id, week: pick.week, teamName: pick.team_name, outcome: pick.outcome },
        teamName,
        games: historicalContext.games,
        laterPicks: picks.filter((item) => item.pick_cycle > pick.pick_cycle || (item.pick_cycle === pick.pick_cycle && item.week > pick.week)),
      });
    } catch (error) { throw new ConflictError(error.message); }
    const projectedPicks = picks.map((item) => item.id === pick.id ? { ...item.toJSON(), team_name: correction.teamName, outcome: correction.outcome } : item);
    const projection = await projectionPlan({ season, track, picks: projectedPicks, transaction });
    const beforePick = repairPickState(pick);
    const afterPick = { ...beforePick, teamName: correction.teamName, outcome: correction.outcome, origin: correction.origin, stateVersion: pick.state_version + 1 };
    const beforeTrack = repairTrackState(track);
    const afterTrack = { ...beforeTrack, ...projection, stateVersion: track.state_version + 1 };
    return { normalizedIntent: { pickId, teamName }, description: `Correct Pick ${pickId} to ${teamName} for Week ${pick.week}`, warnings: [], leagueSeason: season, scheduleHash: historicalContext.scheduleHash, targets: [
      { targetType: "PICK", targetId: pick.id, beforeState: beforePick, afterState: afterPick, stateVersion: afterPick.stateVersion },
      { targetType: "TRACK", targetId: track.id, beforeState: beforeTrack, afterState: afterTrack, stateVersion: afterTrack.stateVersion },
    ], plan: { pick, track, correction, projection }, undoable: true };
  }

  if (action === "RECONCILE_PICK_OUTCOME") {
    const season = await openSeason(transaction, lock);
    const week = Number(input.week);
    const scope = input.scope;
    if (!Number.isInteger(week) || week < 1 || week >= season.current_week || !["SELECTED", "ALL"].includes(scope)) throw new ValidationError("A closed week and selected/all scope are required");
    let pickIds;
    if (scope === "SELECTED") {
      if (!Array.isArray(input.pickIds) || !input.pickIds.length) throw new ValidationError("At least one Pick is required");
      pickIds = [...new Set(input.pickIds.map((value) => positiveId(value, "Pick ID")))];
    }
    const picks = await Pick.findAll({ where: { league_season_id: season.id, week, ...(pickIds ? { id: { [Op.in]: pickIds } } : {}) }, order: [["id", "ASC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if ((pickIds && picks.length !== pickIds.length) || !picks.length) throw new ConflictError("Every requested Pick must exist in the closed week");
    const historicalContext = historicalResultsContext;
    if (!historicalContext || historicalContext.week !== week) throw new ConflictError("Authoritative historical results are required");
    let outcomes;
    try { outcomes = planOutcomeReconciliation({ picks: picks.map((pick) => ({ id: pick.id, trackId: pick.track_id, teamName: pick.team_name, outcome: pick.outcome })), games: historicalContext.games }); }
    catch (error) { throw new ConflictError(error.message); }
    const changed = picks.filter((pick) => outcomes.find((item) => item.pickId === pick.id).outcome !== pick.outcome);
    if (!changed.length) throw new ConflictError("Every requested Pick already matches authoritative results");
    const trackIds = [...new Set(changed.map((pick) => pick.track_id))];
    const tracks = await Track.findAll({ where: { id: { [Op.in]: trackIds } }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    const targets = [];
    const trackPlans = [];
    for (const track of tracks) {
      const allPicks = await Pick.findAll({ where: { track_id: track.id, league_season_id: season.id }, order: [["pick_cycle", "ASC"], ["week", "ASC"], ["id", "ASC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
      const projected = allPicks.map((item) => {
        const change = outcomes.find((candidate) => candidate.pickId === item.id);
        return change ? { ...item.toJSON(), outcome: change.outcome } : item;
      });
      for (const original of allPicks) {
        const change = outcomes.find((candidate) => candidate.pickId === original.id);
        if (change?.outcome === "WRONG_PICK" && original.outcome !== "WRONG_PICK"
          && allPicks.some((later) => later.pick_cycle > original.pick_cycle || (later.pick_cycle === original.pick_cycle && later.week > original.week))) {
          throw new ConflictError("A newly eliminating Pick cannot precede later Picks");
        }
      }
      const projection = await projectionPlan({ season, track, picks: projected, transaction });
      const beforeTrack = repairTrackState(track);
      targets.push({ targetType: "TRACK", targetId: track.id, beforeState: beforeTrack, afterState: { ...beforeTrack, ...projection, stateVersion: track.state_version + 1 }, stateVersion: track.state_version + 1 });
      trackPlans.push({ track, projection });
    }
    for (const pick of changed) {
      const outcome = outcomes.find((item) => item.pickId === pick.id).outcome;
      targets.push({ targetType: "PICK", targetId: pick.id, beforeState: repairPickState(pick), afterState: { ...repairPickState(pick), outcome, stateVersion: pick.state_version + 1 }, stateVersion: pick.state_version + 1 });
    }
    return { normalizedIntent: { scope, week, pickIds: picks.map((pick) => pick.id) }, description: `Reconcile ${changed.length} Pick outcome${changed.length === 1 ? "" : "s"} for Week ${week}`, warnings: [], leagueSeason: season, scheduleHash: historicalContext.scheduleHash, targets, plan: { changed, outcomes, trackPlans }, undoable: true };
  }

  if (action === "REBUILD_TRACK_PROJECTIONS") {
    const season = await openSeason(transaction, lock);
    const scope = input.scope;
    if (!["SELECTED", "ALL"].includes(scope)) throw new ValidationError("Rebuild scope must be SELECTED or ALL");
    let trackIds;
    if (scope === "SELECTED") {
      if (!Array.isArray(input.trackIds) || !input.trackIds.length) throw new ValidationError("At least one Track is required");
      trackIds = [...new Set(input.trackIds.map((value) => positiveId(value, "Track ID")))];
    }
    const tracks = await Track.findAll({ where: { league_season_id: season.id, ...(trackIds ? { id: { [Op.in]: trackIds } } : {}) }, order: [["id", "ASC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if ((trackIds && tracks.length !== trackIds.length) || !tracks.length) throw new ConflictError("Every requested Track must exist in the open League Season");
    const plans = [];
    const targets = [];
    for (const track of tracks) {
      const picks = await Pick.findAll({ where: { track_id: track.id, league_season_id: season.id }, order: [["pick_cycle", "ASC"], ["week", "ASC"], ["id", "ASC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
      let projection;
      try { projection = await projectionPlan({ season, track, picks, transaction }); }
      catch (error) { throw new ConflictError(error.message); }
      const before = repairTrackState(track);
      const comparable = { currentPick: before.currentPick, usedPicks: before.usedPicks, availablePicks: before.availablePicks, wrongPick: before.wrongPick, eliminatedByPickId: before.eliminatedByPickId };
      if (isDeepStrictEqual(comparable, projection)) continue;
      const after = { ...before, ...projection, stateVersion: track.state_version + 1 };
      plans.push({ track, projection });
      targets.push({ targetType: "TRACK", targetId: track.id, beforeState: before, afterState: after, stateVersion: after.stateVersion });
    }
    if (!plans.length) throw new ConflictError("Every requested Track projection is already consistent");
    return { normalizedIntent: { scope, trackIds: tracks.map((track) => track.id) }, description: `Rebuild ${plans.length} inconsistent Track projection${plans.length === 1 ? "" : "s"}`, warnings: [], leagueSeason: season, targets, plan: { plans }, undoable: true };
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

function storedPreview(action, built, expiresAt) {
  return { action, description: built.description, warnings: built.warnings, leagueSeason: built.leagueSeason ? { id: built.leagueSeason.id, year: built.leagueSeason.year, week: built.leagueSeason.current_week } : null, affectedIds: built.targets.map(({ targetType, targetId }) => ({ targetType, targetId })), targets: built.targets, ...(built.unfinishedUnselectedGames ? { unfinishedUnselectedGames: built.unfinishedUnselectedGames } : {}), ...(built.rolloverExport ? { rolloverExport: built.rolloverExport } : {}), expiresAt, undoable: Boolean(built.undoable) };
}

function publicPreview(action, built, expiresAt, confirmationKey) {
  if (action === "SEND_PICK_REMINDERS") return { action, ...built.publicFields, warnings: built.warnings, expiresAt, confirmationKey };
  return { action, description: built.description, warnings: built.warnings, leagueSeason: built.leagueSeason ? { id: built.leagueSeason.id, year: built.leagueSeason.year, week: built.leagueSeason.current_week } : null, affectedIds: built.targets.map(({ targetType, targetId }) => ({ targetType, targetId })), targets: built.targets, ...(built.unfinishedUnselectedGames ? { unfinishedUnselectedGames: built.unfinishedUnselectedGames } : {}), ...(built.rolloverExport ? { rolloverExport: built.rolloverExport } : {}), expiresAt, confirmationKey, undoable: Boolean(built.undoable) };
}

async function createPreview(action, input, options = {}) {
  const preparedOptions = await prepareActionOptions(action, input || {}, options);
  return sequelize.transaction(async (transaction) => {
    const built = await buildActionPreview(action, input || {}, transaction, false, preparedOptions);
    const confirmationKey = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS);
    const preview = publicPreview(action, built, expiresAt, confirmationKey);
    const stored = storedPreview(action, built, expiresAt);
    await AdminActionPreview.create({ confirmation_key_hash: hashKey(confirmationKey), action, normalized_intent: built.normalizedIntent, preview: stored, league_season_id: built.leagueSeason?.id || null, week: built.leagueSeason?.current_week ?? null, league_season_state_version: built.leagueSeason?.state_version ?? null, schedule_hash: built.scheduleHash || null, expires_at: expiresAt }, { transaction });
    return preview;
  });
}

async function confirmPreview(action, confirmationKey, note, options = {}) {
  if (typeof confirmationKey !== "string" || !/^[a-f0-9]{64}$/.test(confirmationKey)) throw new ValidationError("A valid confirmation key is required");
  const previewForContext = await AdminActionPreview.findOne({ where: { confirmation_key_hash: hashKey(confirmationKey) }, attributes: ["action", "normalized_intent", "audit_operation_id"] });
  const preparedOptions = previewForContext?.action === action && !previewForContext.audit_operation_id
    ? await prepareActionOptions(action, previewForContext.normalized_intent, options)
    : options;
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
    const stored = await AdminActionPreview.findOne({ where: { confirmation_key_hash: hashKey(confirmationKey) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!stored || stored.action !== action) throw new NotFoundError("Admin action preview not found");
    if (stored.audit_operation_id) return AdminAuditOperation.findByPk(stored.audit_operation_id, { include: [{ model: AdminAuditTarget, as: "targets" }], transaction });
    if (stored.expires_at <= new Date()) throw new ConflictError("Admin action preview expired");
    const graceTimestamp = stored.preview.targets.find((target) => target.afterState?.accessRemovedAt)?.afterState.accessRemovedAt;
    if (graceTimestamp) preparedOptions.now = new Date(graceTimestamp);
    const built = await buildActionPreview(action, stored.normalized_intent, transaction, true, preparedOptions);
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
    if (action === "RECONCILE_PICK_OUTCOME" && built.normalizedIntent.scope === "ALL" && options.confirmationPhrase !== "RECONCILE EVERY PICK") throw new ValidationError("Type RECONCILE EVERY PICK to confirm the all-Pick reconciliation");
    if (action === "REBUILD_TRACK_PROJECTIONS" && built.normalizedIntent.scope === "ALL" && options.confirmationPhrase !== "REBUILD EVERY TRACK") throw new ValidationError("Type REBUILD EVERY TRACK to confirm the all-Track rebuild");
    if (action === "ROLLOVER_LEAGUE_SEASON" && options.confirmationPhrase !== "YES") throw new ValidationError("Confirm Yes to roll over the League Season");

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
    let auditLeagueSeason = built.leagueSeason;
    if (action === "CREATE_LEAGUE_SEASON") {
      const season = await LeagueSeason.create({ year: built.plan.year, state: "SETUP", current_week: 0, pick_cycle: 1, state_version: 0, open_slot: 1 }, { transaction });
      auditLeagueSeason = season;
      targets = [{ ...built.targets[0], targetId: season.id }];
    } else if (action === "START_LEAGUE_SEASON") {
      await ScheduleSnapshot.findOrCreate({ where: { league_season_id: built.plan.season.id, week: 1, provider: built.plan.schedule.provider || "FIXTURE_DOWNLOAD", content_hash: built.plan.schedule.contentHash }, defaults: { normalized_schedule: built.plan.schedule.normalizedSchedule, fetched_at: built.plan.schedule.fetchedAt || new Date(), created_at: new Date() }, transaction });
      await built.plan.season.update({ state: "ACTIVE", current_week: 1, schedule_phase: "REGULAR", state_version: built.plan.season.state_version + 1 }, { transaction });
    } else if (action === "ENABLE_PRESEASON") {
      await clearSeasonGameplay(built.plan.season.id, transaction);
      await built.plan.season.update({ state: "ACTIVE", current_week: built.plan.preseasonWeek, schedule_phase: "PRESEASON", preseason_complete: false, late_week_one_enrollment: false, pick_cycle: 1, state_version: built.plan.season.state_version + 1 }, { transaction });
    } else if (action === "START_REGULAR_SEASON") {
      await clearSeasonGameplay(built.plan.season.id, transaction);
      await ScheduleSnapshot.create({ league_season_id: built.plan.season.id, week: 1, provider: built.plan.schedule.provider || "FIXTURE_DOWNLOAD", content_hash: built.plan.schedule.contentHash, normalized_schedule: built.plan.schedule.normalizedSchedule, fetched_at: built.plan.schedule.fetchedAt || new Date(), created_at: new Date() }, { transaction });
      await built.plan.season.update({ state: "ACTIVE", current_week: 1, schedule_phase: "REGULAR", preseason_complete: false, late_week_one_enrollment: built.plan.late, pick_cycle: 1, state_version: built.plan.season.state_version + 1 }, { transaction });
    } else if (action === "ADD_USER_WIN") {
      const user = await User.findByPk(built.normalizedIntent.userId, { transaction, lock: transaction.LOCK.UPDATE });
      await user.addWin(built.normalizedIntent.year, built.normalizedIntent.wonWithTie, { transaction });
      targets = [{ ...built.targets[0], afterState: { userRecord: user.user_record, crownType: user.getCrownType() } }];
    } else if (action === "COMPLETE_LEAGUE_SEASON") {
      for (const user of built.plan.users) await user.addWin(built.leagueSeason.year, built.plan.winners.wonWithTie, { transaction });
      await built.plan.season.update({ state: "COMPLETE", open_slot: null, state_version: built.plan.season.state_version + 1 }, { transaction });
    } else if (action === "ROLLOVER_LEAGUE_SEASON") {
      await TrackReactivation.destroy({ where: { league_season_id: built.plan.season.id }, transaction });
      await Pick.destroy({ where: { league_season_id: built.plan.season.id }, transaction });
      await Track.destroy({ where: { league_season_id: built.plan.season.id }, transaction });
      await built.plan.season.update({ state: "ROLLED_OVER", open_slot: null, state_version: built.plan.season.state_version + 1 }, { transaction });
      const successor = await LeagueSeason.create({ year: built.plan.targetYear, state: "SETUP", current_week: 0, pick_cycle: 1, state_version: 0, open_slot: 1 }, { transaction });
      targets = [...built.targets, { targetType: "LEAGUE_SEASON", targetId: successor.id, beforeState: null, afterState: { year: successor.year, state: successor.state, week: successor.current_week, stateVersion: successor.state_version }, stateVersion: 0 }];
    } else if (action === "CREATE_TRACK") {
      const teams = await Team.findAll({ attributes: ["team_name"], transaction });
      const track = await Track.create({ user_id: built.normalizedIntent.userId, league_season_id: built.leagueSeason.id, available_picks: teams.map((team) => team.team_name), used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 }, { transaction });
      targets = [{ targetType: "TRACK", targetId: track.id, beforeState: null, afterState: trackState(track), stateVersion: 0 }];
    } else if (action === "DELETE_TRACK") {
      await Track.destroy({ where: { id: built.normalizedIntent.trackId }, transaction });
    } else if (action === "DELETE_USER") {
      await Track.destroy({ where: { user_id: built.normalizedIntent.userId }, transaction });
      await User.destroy({ where: { id: built.normalizedIntent.userId }, transaction });
    } else if (action === "SET_PICK_REMINDERS_BETA_ACCESS") {
      const [entitlement] = await UserFeatureEntitlement.findOrCreate({ where: { user_id: built.normalizedIntent.userId, feature_key: PICK_REMINDERS }, defaults: { enabled: false, state_version: 0 }, transaction });
      await entitlement.update({ enabled: built.normalizedIntent.enabled, state_version: entitlement.state_version + 1 }, { transaction });
      const release = await FeatureRelease.findByPk(PICK_REMINDERS, { transaction, lock: transaction.LOCK.UPDATE });
      if (built.normalizedIntent.enabled || release.public_released) {
        await UserFeatureAccessState.destroy({ where: { user_id: built.normalizedIntent.userId, feature_key: PICK_REMINDERS }, transaction });
      } else {
        await UserFeatureAccessState.upsert({ user_id: built.normalizedIntent.userId, feature_key: PICK_REMINDERS, ...built.plan.grace }, { transaction });
      }
    } else if (action === "SET_PICK_REMINDERS_PUBLIC_RELEASE") {
      const release = await FeatureRelease.findByPk(PICK_REMINDERS, { transaction, lock: transaction.LOCK.UPDATE });
      await release.update({ public_released: built.normalizedIntent.enabled, state_version: release.state_version + 1 }, { transaction });
      if (built.normalizedIntent.enabled) {
        await UserFeatureAccessState.destroy({ where: { feature_key: PICK_REMINDERS }, transaction });
      } else {
        const users = await User.findAll({ attributes: ["id"], transaction, lock: transaction.LOCK.UPDATE });
        const entitled = await UserFeatureEntitlement.findAll({ where: { feature_key: PICK_REMINDERS, enabled: true }, attributes: ["user_id"], transaction, lock: transaction.LOCK.UPDATE });
        const entitledIds = new Set(entitled.map((item) => item.user_id));
        const grace = built.plan.grace;
        for (const user of users.filter((item) => !entitledIds.has(item.id))) await UserFeatureAccessState.upsert({ user_id: user.id, feature_key: PICK_REMINDERS, ...grace }, { transaction });
      }
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
    } else if (action === "CORRECT_HISTORICAL_PICK") {
      await built.plan.pick.update({ team_name: built.plan.correction.teamName, outcome: built.plan.correction.outcome, origin: built.plan.correction.origin, state_version: built.plan.pick.state_version + 1 }, { transaction });
      const projection = built.plan.projection;
      await built.plan.track.update({ current_pick: projection.currentPick, used_picks: projection.usedPicks, available_picks: projection.availablePicks, wrong_pick: projection.wrongPick, eliminated_by_pick_id: projection.eliminatedByPickId, state_version: built.plan.track.state_version + 1 }, { transaction });
    } else if (action === "RECONCILE_PICK_OUTCOME") {
      for (const pick of built.plan.changed) {
        const outcome = built.plan.outcomes.find((item) => item.pickId === pick.id).outcome;
        await pick.update({ outcome, state_version: pick.state_version + 1 }, { transaction });
      }
      for (const { track, projection } of built.plan.trackPlans) await track.update({ current_pick: projection.currentPick, used_picks: projection.usedPicks, available_picks: projection.availablePicks, wrong_pick: projection.wrongPick, eliminated_by_pick_id: projection.eliminatedByPickId, state_version: track.state_version + 1 }, { transaction });
    } else if (action === "REBUILD_TRACK_PROJECTIONS") {
      for (const { track, projection } of built.plan.plans) await track.update({ current_pick: projection.currentPick, used_picks: projection.usedPicks, available_picks: projection.availablePicks, wrong_pick: projection.wrongPick, eliminated_by_pick_id: projection.eliminatedByPickId, state_version: track.state_version + 1 }, { transaction });
    } else if (action === "UNDO_ADMIN_ACTION") {
      for (const { target, model, restored: desired } of built.plan.loadedTargets) {
        if (target.target_type === "TRACK") {
          if (!model || !desired) throw new ConflictError("Undo cannot recreate or delete a Track");
          await model.update(trackWriteState(desired), { transaction });
        } else if (target.target_type === "PICK") {
          if (model && desired === null) await model.destroy({ transaction });
          else if (!model && desired) await Pick.create({ id: target.target_id, ...pickWriteState(desired) }, { transaction });
          else if (model && desired) await model.update(pickWriteState(desired), { transaction });
        }
      }
      if (built.plan.operation.action === "REACTIVATE_TRACK") await TrackReactivation.destroy({ where: { admin_audit_operation_id: built.plan.operation.id }, transaction });
    }

    const auditNote = action === "OVERRIDE_GAME_RESULT" ? built.normalizedIntent.explanation : action === "REACTIVATE_TRACK" ? built.normalizedIntent.correctionNote : normalizeNote(note);
    const operation = await AdminAuditOperation.create({ action, description: built.description, note: auditNote, status: "COMMITTED", league_season_id: auditLeagueSeason?.id || null, week: action === "START_LEAGUE_SEASON" ? 1 : auditLeagueSeason?.current_week ?? null, summary: { affectedCount: targets.length, ...(built.rolloverExport ? { exportChecksum: built.rolloverExport.exportChecksum, deleted: built.rolloverExport.counts } : {}) }, undoable: Boolean(built.undoable) }, { transaction });
    if (action === "SEND_PICK_REMINDERS") {
      const campaign = await createCampaignWithDeliveries({ season: built.leagueSeason, deadline: built.plan.deadline, kind: "MANUAL", candidates: built.plan.deliveries, evaluated: built.plan.evaluated, now: built.plan.currentTime, auditOperationId: operation.id, transaction });
      if (!campaign.created) throw new ConflictError("The manual Pick Reminders campaign already exists for this round");
      await operation.update({ summary: { evaluated: built.plan.evaluated, eligibleDeliveries: { email: built.plan.deliveries.filter(({ channel }) => channel === "EMAIL").length, push: built.plan.deliveries.filter(({ channel }) => channel === "PUSH").length } } }, { transaction });
    }
    if (action === "UNDO_ADMIN_ACTION") await built.plan.operation.update({ status: "UNDONE", undone_by_operation_id: operation.id }, { transaction });
    if (action === "OVERRIDE_GAME_RESULT") {
      const intent = built.normalizedIntent;
      await OfficialGameResultOverride.create({ league_season_id: built.leagueSeason.id, week: built.leagueSeason.current_week, matchup_key: matchupKey(intent.homeTeam, intent.awayTeam), home_team: intent.homeTeam, away_team: intent.awayTeam, home_score: intent.homeScore, away_score: intent.awayScore, winner_team: intent.winnerTeam, loser_team: intent.loserTeam, tied: intent.tied, schedule_hash: intent.scheduleHash, explanation: intent.explanation, source_url: intent.sourceUrl, admin_audit_operation_id: operation.id, created_at: new Date() }, { transaction });
    } else if (action === "REACTIVATE_TRACK") {
      await TrackReactivation.create({ track_id: built.plan.track.id, league_season_id: built.leagueSeason.id, waived_pick_id: built.plan.waivedPickId, admin_audit_operation_id: operation.id, created_at: new Date() }, { transaction });
    }
    const featureTargets = targets.filter((target) => target.targetType === "FEATURE");
    const modelTargets = targets.filter((target) => target.targetType !== "FEATURE");
    await AdminAuditTarget.bulkCreate(modelTargets.map((target) => ({ admin_audit_operation_id: operation.id, target_type: target.targetType, target_id: target.targetId, before_state: target.beforeState, after_state: target.afterState, state_version: target.stateVersion ?? target.afterState?.stateVersion ?? null })), { transaction });
    await FeatureAdminAuditTarget.bulkCreate(featureTargets.map((target) => ({ admin_audit_operation_id: operation.id, feature_key: target.targetId, before_state: target.beforeState, after_state: target.afterState, state_version: target.afterState.stateVersion })), { transaction });
    await stored.update({ consumed_at: new Date(), audit_operation_id: operation.id }, { transaction });
    return AdminAuditOperation.findByPk(operation.id, { include: [{ model: AdminAuditTarget, as: "targets" }], transaction });
  });
}

module.exports = { PREVIEW_TTL_MS, confirmPreview, createPreview, hashKey };
