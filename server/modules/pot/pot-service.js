const { QueryTypes, Transaction } = require("sequelize");
const { sequelize, LeagueSeason } = require("../../../models");

// Used inside the correction transaction as well as the read-only pot endpoint.
async function getPotTotals({ seasonId, transaction, userId = null, trackId = null }) {
  const exemptions = await sequelize.query("SELECT user_id FROM league_pot_exemption", { type: QueryTypes.SELECT, transaction });
  if (exemptions.length !== 1) throw new Error("League pot exemption is not configured");
  const replacements = { seasonId, exemptUserId: exemptions[0].user_id, userId, trackId };
  const [counts] = await sequelize.query(`SELECT
    (SELECT COUNT(*) FROM track t WHERE t.league_season_id = :seasonId AND t.user_id <> :exemptUserId
      AND (:userId IS NULL OR t.user_id = :userId) AND (:trackId IS NULL OR t.id = :trackId)) AS trackCount,
    (SELECT COUNT(DISTINCT t.id) FROM buyback_decision_track bt
      JOIN buyback_decision d ON d.id = bt.buyback_decision_id
      JOIN track t ON t.id = bt.track_id AND t.user_id = d.user_id AND t.league_season_id = d.league_season_id
      WHERE d.league_season_id = :seasonId AND t.user_id <> :exemptUserId
        AND (:userId IS NULL OR t.user_id = :userId) AND (:trackId IS NULL OR t.id = :trackId)
        AND bt.resolution = 'FULFILLED' AND bt.reversed_by_operation_id IS NULL
        AND d.status IN ('COMPLETED_USER_REQUEST', 'COMPLETED_ADMIN_DIRECT')) AS buybackCount,
    (SELECT COALESCE(SUM(amount_cents), 0) FROM league_pot_adjustment
      WHERE league_season_id = :seasonId AND user_id <> :exemptUserId
        AND (:userId IS NULL OR user_id = :userId) AND (:trackId IS NULL OR track_id = :trackId)) AS adjustmentCents`,
  { replacements, type: QueryTypes.SELECT, transaction });
  const trackCount = Number(counts.trackCount);
  const buybackCount = Number(counts.buybackCount);
  const adjustmentCents = Number(counts.adjustmentCents);
  const baseCents = trackCount * 500;
  const buybackCents = buybackCount * 1000;
  return { trackCount, buybackCount, baseCents, buybackCents, adjustmentCents, totalCents: baseCents + buybackCents + adjustmentCents };
}

async function getLeaguePot() {
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1 }, transaction })
      || await LeagueSeason.findOne({ where: { state: "COMPLETE" }, order: [["year", "DESC"]], transaction });
    if (!season) return { leagueSeason: null };
    return { leagueSeason: { year: season.year, schedulePhase: season.schedule_phase }, ...await getPotTotals({ seasonId: season.id, transaction }) };
  });
}
module.exports = { getLeaguePot, getPotTotals };
