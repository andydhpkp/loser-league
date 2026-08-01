const { Op, Transaction } = require("sequelize");

const sequelize = require("../../../config/connection");
const {
  LeagueSeason,
  Pick,
  Track,
} = require("../../../models/my-index");
const { planLegacyTrackBackfill } = require("./legacy-track-backfill");

function validateBootstrapLifecycle({ year, state, week }) {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error("Bootstrap requires a four-digit League Season year");
  }
  if (!Number.isInteger(week) || week < 0 || week > 22) {
    throw new Error("Bootstrap requires a League Season week from 0 to 22");
  }
  if (!new Set(["SETUP", "ACTIVE"]).has(state)) {
    throw new Error("Bootstrap state must be SETUP or ACTIVE");
  }
  if (state === "SETUP" && week !== 0) {
    throw new Error("League Season setup is restricted to Week 0");
  }
  if (state === "ACTIVE" && week < 1) {
    throw new Error("An active League Season requires an active week");
  }
}

function toLegacyTrack(track) {
  return {
    id: track.id,
    availablePicks: track.available_picks,
    usedPicks: track.used_picks,
    currentPick: track.current_pick,
    wrongPick: track.wrong_pick,
  };
}

function summarize({ year, state, week, plans, applied, alreadyApplied }) {
  return {
    applied,
    alreadyApplied,
    year,
    state,
    week,
    trackCount: plans.length,
    pickCount: plans.reduce((count, plan) => count + plan.picks.length, 0),
    eliminatedTrackCount: plans.filter(
      (plan) => plan.eliminatingPickWeek !== null
    ).length,
  };
}

async function assertExistingBootstrapMatches({ season, tracks, plans, transaction }) {
  if (tracks.some((track) => track.league_season_id !== season.id)) {
    throw new Error("Existing League Season bootstrap is incomplete");
  }

  const storedPicks = await Pick.findAll({
    where: { league_season_id: season.id },
    order: [
      ["track_id", "ASC"],
      ["week", "ASC"],
    ],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const expectedPicks = plans.flatMap((plan) =>
    plan.picks.map((pick) => ({ ...pick, trackId: plan.trackId }))
  );
  if (storedPicks.length !== expectedPicks.length) {
    throw new Error("Existing League Season Pick backfill does not match");
  }
  for (let index = 0; index < expectedPicks.length; index += 1) {
    const stored = storedPicks[index];
    const expected = expectedPicks[index];
    if (
      stored.track_id !== expected.trackId ||
      stored.week !== expected.week ||
      stored.team_name !== expected.teamName ||
      stored.outcome !== expected.outcome ||
      stored.origin !== "LEGACY_BACKFILL"
    ) {
      throw new Error("Existing League Season Pick backfill does not match");
    }
  }

  const storedById = new Map(storedPicks.map((pick) => [pick.id, pick]));
  for (let index = 0; index < tracks.length; index += 1) {
    const track = tracks[index];
    const plan = plans[index];
    if (plan.eliminatingPickWeek === null) {
      if (track.eliminated_by_pick_id !== null) {
        throw new Error("Existing League Season elimination backfill does not match");
      }
      continue;
    }
    const eliminatingPick = storedById.get(track.eliminated_by_pick_id);
    if (
      !eliminatingPick ||
      eliminatingPick.track_id !== track.id ||
      eliminatingPick.week !== plan.eliminatingPickWeek ||
      eliminatingPick.outcome !== "WRONG_PICK"
    ) {
      throw new Error("Existing League Season elimination backfill does not match");
    }
  }
}

async function bootstrapLeagueSeason({
  year,
  state,
  week,
  apply = false,
  weekOneBuybackTrackIds = [],
}) {
  validateBootstrapLifecycle({ year, state, week });
  if (
    !Array.isArray(weekOneBuybackTrackIds) ||
    weekOneBuybackTrackIds.some(
      (trackId) => !Number.isInteger(trackId) || trackId < 1
    ) ||
    new Set(weekOneBuybackTrackIds).size !== weekOneBuybackTrackIds.length
  ) {
    throw new Error("Week 1 buyback Track IDs must be unique positive integers");
  }
  const buybackTrackIds = new Set(weekOneBuybackTrackIds);

  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
    async (transaction) => {
      const tracks = await Track.findAll({
        order: [["id", "ASC"]],
        transaction,
        ...(apply ? { lock: transaction.LOCK.UPDATE } : {}),
      });
      const plans = tracks.map((track) =>
        planLegacyTrackBackfill({
          currentWeek: week,
          track: toLegacyTrack(track),
          weekOneBuyback: buybackTrackIds.has(track.id),
        })
      );
      const foundTrackIds = new Set(tracks.map((track) => track.id));
      if (weekOneBuybackTrackIds.some((trackId) => !foundTrackIds.has(trackId))) {
        throw new Error("Week 1 buyback Track ID does not exist");
      }
      const baseSummary = { year, state, week, plans };

      const existingSeason = await LeagueSeason.findOne({
        where: { year },
        transaction,
        ...(apply ? { lock: transaction.LOCK.UPDATE } : {}),
      });
      if (existingSeason) {
        if (
          existingSeason.state !== state ||
          existingSeason.current_week !== week ||
          existingSeason.open_slot !== 1
        ) {
          throw new Error("Existing League Season conflicts with bootstrap input");
        }
        await assertExistingBootstrapMatches({
          season: existingSeason,
          tracks,
          plans,
          transaction,
        });
        return summarize({
          ...baseSummary,
          applied: false,
          alreadyApplied: true,
        });
      }

      if (tracks.some((track) => track.league_season_id !== null)) {
        throw new Error("Track already belongs to a League Season");
      }

      const conflictingOpenSeason = await LeagueSeason.findOne({
        where: { open_slot: 1, year: { [Op.ne]: year } },
        transaction,
        ...(apply ? { lock: transaction.LOCK.UPDATE } : {}),
      });
      if (conflictingOpenSeason) {
        throw new Error("Another League Season is already open");
      }

      if (!apply) {
        return summarize({
          ...baseSummary,
          applied: false,
          alreadyApplied: false,
        });
      }

      const season = await LeagueSeason.create(
        {
          year,
          state,
          current_week: week,
          state_version: 0,
          open_slot: 1,
        },
        { transaction }
      );

      for (let index = 0; index < tracks.length; index += 1) {
        const track = tracks[index];
        const plan = plans[index];
        if (track.league_season_id !== null) {
          throw new Error("Track already belongs to a League Season");
        }

        let eliminatingPickId = null;
        for (const plannedPick of plan.picks) {
          const pick = await Pick.create(
            {
              track_id: track.id,
              league_season_id: season.id,
              week: plannedPick.week,
              team_name: plannedPick.teamName,
              origin: "LEGACY_BACKFILL",
              outcome: plannedPick.outcome,
              committed_at: new Date(),
              state_version: 0,
            },
            { transaction }
          );
          if (plannedPick.week === plan.eliminatingPickWeek) {
            eliminatingPickId = pick.id;
          }
        }

        await track.update(
          {
            league_season_id: season.id,
            eliminated_by_pick_id: eliminatingPickId,
            state_version: 0,
          },
          { transaction }
        );
      }

      return summarize({
        ...baseSummary,
        applied: true,
        alreadyApplied: false,
      });
    }
  );
}

module.exports = { bootstrapLeagueSeason, validateBootstrapLifecycle };
