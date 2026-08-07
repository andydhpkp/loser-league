const express = require("express");
const { LeagueSeason, Track } = require("../../models");
const { requireAdmin } = require("./require-admin");

function createAdminLeagueSeasonRouter() {
  const router = express.Router();
  router.use(requireAdmin);
  router.get("/", async (_req, res, next) => {
    try {
      const [openSeason, unassignedTrackCount] = await Promise.all([
        LeagueSeason.findOne({ where: { open_slot: 1 }, attributes: ["id", "year", "state", "current_week", "schedule_phase", "preseason_complete", "late_week_one_enrollment", "state_version"] }),
        Track.count({ where: { league_season_id: null } }),
      ]);
      const season = openSeason || await LeagueSeason.findOne({ where: { state: "COMPLETE" }, attributes: ["id", "year", "state", "current_week", "state_version"], order: [["year", "DESC"]] });
      res.json({
        leagueSeason: season ? { id: season.id, year: season.year, state: season.state, week: season.current_week, schedulePhase: season.schedule_phase, preseasonComplete: season.preseason_complete, lateWeekOneEnrollment: season.late_week_one_enrollment, stateVersion: season.state_version } : null,
        unassignedTrackCount,
      });
    } catch (error) { next(error); }
  });
  return router;
}

module.exports = { createAdminLeagueSeasonRouter };
