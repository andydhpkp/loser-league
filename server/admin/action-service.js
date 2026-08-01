const crypto = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { Transaction } = require("sequelize");
const {
  sequelize,
  User,
  Track,
  Team,
  LeagueSeason,
  ScheduleSnapshot,
  OfficialGameResultOverride,
  AdminActionPreview,
  AdminAuditOperation,
  AdminAuditTarget,
} = require("../../models");
const { ConflictError, NotFoundError, ValidationError } = require("../lib/errors");
const { getAdminAction } = require("./action-registry");
const { closeWeek } = require("../modules/week-closure/week-closure-service");

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

  if (action !== "DELETE_USER") throw new NotFoundError("Admin action not found");
  const userId = positiveId(input.userId, "User ID");
  const user = await User.findByPk(userId, { attributes: ["id"], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!user) throw new NotFoundError("User not found");
  const tracks = await Track.findAll({ where: { user_id: userId }, attributes: ["id", "league_season_id", "state_version"], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
  return { normalizedIntent: { userId }, description: `Permanently delete User ${userId} and ${tracks.length} owned Tracks`, warnings: ["This action cannot be undone."], leagueSeason: null, targets: [{ targetType: "USER", targetId: userId, beforeState: { exists: true }, afterState: null }, ...tracks.map((track) => ({ targetType: "TRACK", targetId: track.id, beforeState: trackState(track), afterState: null }))] };
}

function publicPreview(action, built, expiresAt, confirmationKey) {
  return { action, description: built.description, warnings: built.warnings, leagueSeason: built.leagueSeason ? { id: built.leagueSeason.id, year: built.leagueSeason.year, week: built.leagueSeason.current_week } : null, affectedIds: built.targets.map(({ targetType, targetId }) => ({ targetType, targetId })), targets: built.targets, ...(built.unfinishedUnselectedGames ? { unfinishedUnselectedGames: built.unfinishedUnselectedGames } : {}), expiresAt, confirmationKey, undoable: false };
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
    }

    const auditNote = action === "OVERRIDE_GAME_RESULT" ? built.normalizedIntent.explanation : normalizeNote(note);
    const operation = await AdminAuditOperation.create({ action, description: built.description, note: auditNote, status: "COMMITTED", league_season_id: built.leagueSeason?.id || null, week: built.leagueSeason?.current_week ?? null, summary: { affectedCount: targets.length }, undoable: false }, { transaction });
    if (action === "OVERRIDE_GAME_RESULT") {
      const intent = built.normalizedIntent;
      await OfficialGameResultOverride.create({ league_season_id: built.leagueSeason.id, week: built.leagueSeason.current_week, matchup_key: matchupKey(intent.homeTeam, intent.awayTeam), home_team: intent.homeTeam, away_team: intent.awayTeam, home_score: intent.homeScore, away_score: intent.awayScore, winner_team: intent.winnerTeam, loser_team: intent.loserTeam, tied: intent.tied, schedule_hash: intent.scheduleHash, explanation: intent.explanation, source_url: intent.sourceUrl, admin_audit_operation_id: operation.id, created_at: new Date() }, { transaction });
    }
    await AdminAuditTarget.bulkCreate(targets.map((target) => ({ admin_audit_operation_id: operation.id, target_type: target.targetType, target_id: target.targetId, before_state: target.beforeState, after_state: target.afterState, state_version: target.stateVersion ?? target.afterState?.stateVersion ?? null })), { transaction });
    await stored.update({ consumed_at: new Date(), audit_operation_id: operation.id }, { transaction });
    return AdminAuditOperation.findByPk(operation.id, { include: [{ model: AdminAuditTarget, as: "targets" }], transaction });
  });
}

module.exports = { PREVIEW_TTL_MS, confirmPreview, createPreview, hashKey };
