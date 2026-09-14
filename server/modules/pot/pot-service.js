const { QueryTypes, Transaction } = require("sequelize");
const { sequelize, LeagueSeason } = require("../../../models");

async function getLeaguePot() {
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1 }, transaction })
      || await LeagueSeason.findOne({ where: { state: "COMPLETE" }, order: [["year", "DESC"]], transaction });
    if (!season) return { leagueSeason: null };
    const exemptions = await sequelize.query("SELECT user_id FROM league_pot_exemption", { type: QueryTypes.SELECT, transaction });
    if (exemptions.length !== 1) throw new Error("League pot exemption is not configured");
    const replacements = { seasonId: season.id, exemptUserId: exemptions[0].user_id };
    const [counts] = await sequelize.query(`SELECT
      (SELECT COUNT(*) FROM track WHERE league_season_id = :seasonId AND user_id <> :exemptUserId) AS trackCount,
      (SELECT COUNT(DISTINCT t.id) FROM buyback_decision_track bt
        JOIN buyback_decision d ON d.id = bt.buyback_decision_id
        JOIN track t ON t.id = bt.track_id AND t.user_id = d.user_id AND t.league_season_id = d.league_season_id
        WHERE d.league_season_id = :seasonId AND t.user_id <> :exemptUserId
          AND bt.resolution = 'FULFILLED'
          AND d.status IN ('COMPLETED_USER_REQUEST', 'COMPLETED_ADMIN_DIRECT')) AS buybackCount`,
    { replacements, type: QueryTypes.SELECT, transaction });
    const trackCount = Number(counts.trackCount);
    const buybackCount = Number(counts.buybackCount);
    const baseCents = trackCount * 500;
    const buybackCents = buybackCount * 1000;
    return { leagueSeason: { year: season.year, schedulePhase: season.schedule_phase },
      trackCount, buybackCount, baseCents, buybackCents, totalCents: baseCents + buybackCents };
  });
}
module.exports = { getLeaguePot };
