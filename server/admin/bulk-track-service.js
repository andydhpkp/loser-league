const { Op } = require("sequelize");
const sequelize = require("../../config/connection");
const { LeagueSeason, ScheduleSnapshot, Team, Track, User } = require("../../models");
const { ConflictError, NotFoundError, ValidationError } = require("../lib/errors");
const { isTrackEnrollmentOpen } = require("../modules/league-season/enrollment-policy");

function normalizeAdditions(additions) {
  if (!Array.isArray(additions) || additions.length === 0) {
    throw new ValidationError("Choose at least one User and Track quantity");
  }
  const normalized = additions.map(({ userId, quantity }) => ({
    userId: Number(userId),
    quantity: Number(quantity),
  }));
  if (normalized.some(({ userId, quantity }) =>
    !Number.isInteger(userId) || userId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 100
  )) {
    throw new ValidationError("Each Track quantity must be a whole number from 1 through 100");
  }
  if (new Set(normalized.map(({ userId }) => userId)).size !== normalized.length) {
    throw new ValidationError("Each User may appear only once");
  }
  return normalized;
}

function earliestKickoff(snapshot) {
  const values = (snapshot?.normalized_schedule?.games || [])
    .map((game) => new Date(game.kickoff))
    .filter((date) => !Number.isNaN(date.getTime()));
  return values.length ? new Date(Math.min(...values.map(Number))) : null;
}

async function createTracksInBulk(additions, { now = new Date() } = {}) {
  const normalized = normalizeAdditions(additions);
  return sequelize.transaction(async (transaction) => {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1 }, transaction, lock: transaction.LOCK.UPDATE });
    if (!season) throw new ConflictError("League Season configuration is unavailable");
    const schedule = season.current_week === 1
      ? await ScheduleSnapshot.findOne({ where: { league_season_id: season.id, week: 1 }, order: [["fetched_at", "DESC"]], transaction, lock: transaction.LOCK.UPDATE })
      : null;
    if (!isTrackEnrollmentOpen({ season, earliestKickoff: earliestKickoff(schedule), now })) {
      throw new ConflictError("Track enrollment is closed");
    }

    const userIds = normalized.map(({ userId }) => userId);
    const users = await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ["id", "first_name", "last_name", "username"], transaction, lock: transaction.LOCK.UPDATE });
    if (users.length !== userIds.length) throw new NotFoundError("One or more selected Users no longer exist");
    const teams = await Team.findAll({ attributes: ["team_name"], transaction });
    const availablePicks = teams.map((team) => team.team_name);
    const rows = normalized.flatMap(({ userId, quantity }) => Array.from({ length: quantity }, () => ({
      user_id: userId,
      league_season_id: season.id,
      available_picks: availablePicks,
      used_picks: [],
      current_pick: null,
      wrong_pick: null,
      state_version: 0,
    })));
    await Track.bulkCreate(rows, { transaction });
    const byId = new Map(users.map((user) => [user.id, user]));
    return {
      leagueSeason: { year: season.year, week: season.current_week },
      totalCreated: rows.length,
      additions: normalized.map(({ userId, quantity }) => {
        const user = byId.get(userId);
        return { userId, quantity, displayName: `${user.first_name} ${user.last_name}`.trim(), username: user.username };
      }),
    };
  });
}

module.exports = { createTracksInBulk, normalizeAdditions };
