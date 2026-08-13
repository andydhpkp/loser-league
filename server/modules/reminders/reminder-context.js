const { LeagueSeason, ScheduleSnapshot } = require("../../../models");
const { fetchFixtureSchedule } = require("../../nfl/fixture-download-client");

function createAuthoritativeReminderContextLoader({ fetchImpl = global.fetch, now = () => new Date() } = {}) {
  return async function loadAuthoritativeContext() {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1 } });
    if (!season || season.state !== "ACTIVE" || season.current_week < 1) return { season, deadline: null };
    const schedule = await fetchFixtureSchedule({ year: season.year, week: season.current_week, seasonPhase: season.schedule_phase, allowStartedGames: season.schedule_phase === "PRESEASON" || season.late_week_one_enrollment, now: now(), fetchImpl });
    await ScheduleSnapshot.findOrCreate({ where: { league_season_id: season.id, week: season.current_week, provider: schedule.provider, content_hash: schedule.contentHash }, defaults: { normalized_schedule: schedule.normalizedSchedule, fetched_at: schedule.fetchedAt, created_at: now() } });
    return { season, deadline: schedule.earliestKickoff, scheduleHash: schedule.contentHash };
  };
}

module.exports = { createAuthoritativeReminderContextLoader };
