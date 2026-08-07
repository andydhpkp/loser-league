const { LeagueSeason, ScheduleSnapshot } = require("../../../models");
const { fetchFixtureSchedule } = require("../../nfl/fixture-download-client");
const { executeAutoPick } = require("./auto-pick-service");

const FINAL_WINDOW_MS = 15 * 60 * 1000;
const NORMAL_REFRESH_MS = 5 * 60 * 1000;
const FINAL_REFRESH_MS = 30 * 1000;

function createAutoPickEvaluator({ findSeason, fetchSchedule, persistSchedule, execute, now = () => new Date() }) {
  let cachedSchedule;
  return async function evaluate() {
    const season = await findSeason();
    if (!season || season.state !== "ACTIVE" || season.current_week === 0) return { status: "NOT_DUE", deadline: null };
    const currentTime = now();
    if (cachedSchedule && (cachedSchedule.year !== season.year || cachedSchedule.week !== season.current_week || cachedSchedule.seasonPhase !== season.schedule_phase)) cachedSchedule = undefined;
    const untilDeadline = cachedSchedule ? cachedSchedule.earliestKickoff.getTime() - currentTime.getTime() : Infinity;
    const refreshMs = untilDeadline <= FINAL_WINDOW_MS ? FINAL_REFRESH_MS : NORMAL_REFRESH_MS;
    if (!cachedSchedule || currentTime.getTime() - cachedSchedule.fetchedAt.getTime() >= refreshMs) {
      cachedSchedule = await fetchSchedule({ year: season.year, week: season.current_week, seasonPhase: season.schedule_phase, allowStartedGames: season.schedule_phase === "PRESEASON" || season.late_week_one_enrollment, now: currentTime });
      await persistSchedule({ season, schedule: cachedSchedule, now: currentTime });
    }
    const result = await execute({ schedule: cachedSchedule, now: currentTime });
    return { ...result, deadline: cachedSchedule.earliestKickoff };
  };
}

function createDefaultAutoPickEvaluator({ fetchImpl = global.fetch, now = () => new Date() } = {}) {
  return createAutoPickEvaluator({
    findSeason: () => LeagueSeason.findOne({ where: { open_slot: 1 } }),
    fetchSchedule: (input) => fetchFixtureSchedule({ ...input, fetchImpl }),
    persistSchedule: async ({ season, schedule, now: currentTime }) => {
      await ScheduleSnapshot.findOrCreate({
        where: { league_season_id: season.id, week: season.current_week, provider: schedule.provider, content_hash: schedule.contentHash },
        defaults: { normalized_schedule: schedule.normalizedSchedule, fetched_at: schedule.fetchedAt, created_at: currentTime },
      });
    },
    execute: ({ schedule }) => executeAutoPick({ schedule, now }),
    now,
  });
}

module.exports = { createAutoPickEvaluator, createDefaultAutoPickEvaluator };
