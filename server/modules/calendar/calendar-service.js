const crypto = require("node:crypto");
const { Op } = require("sequelize");
const { sequelize, CalendarEvent, CalendarFeedState } = require("../../../models");
const { reconcileEvents, visibleEvents, HISTORY_MS } = require("./calendar-publication");
const { serializeCalendar, stableEventUid } = require("./calendar-serializer");

const STATE_ID = 1;
const CLEANUP_BATCH = 100;

function digest(content) { return crypto.createHash("sha256").update(content).digest("hex"); }
function eventView(row) { return { year: row.season_year, phase: row.schedule_phase, round: row.round, uid: row.event_uid, deadline: row.deadline, sequence: row.sequence, status: row.status, sourceHash: row.source_hash, revisedAt: row.last_published_at, cancelledAt: row.cancelled_at }; }

function createCalendarService({ loadSchedule, configuration, now = () => new Date(), logger, database = sequelize, Event = CalendarEvent, FeedState = CalendarFeedState } = {}) {
  const emptyContent = serializeCalendar({ events: [], dashboardUrl: configuration.dashboardUrl || "https://invalid.example/dashboard.html" });
  const emptyHash = digest(emptyContent);

  async function refresh() {
    if (!configuration.dashboardUrl) return { status: "UNAVAILABLE" };
    let schedule;
    try { schedule = await loadSchedule(); }
    catch (error) { logger.warn("calendar_refresh_failed", { reason: error.code || error.name }); return { status: "FALLBACK" }; }
    const refreshedAt = now();
    return database.transaction(async (transaction) => {
      let state = await FeedState.findByPk(STATE_ID, { transaction, lock: transaction.LOCK.UPDATE });
      const rows = await Event.findAll({ transaction, lock: transaction.LOCK.UPDATE });
      const evidenceKeys = new Set((schedule.evidence || []).map((item) => `${item.year}:${item.phase}:${item.round}`));
      const activePhases = schedule.season?.schedule_phase === "PRESEASON" ? new Set(["PRESEASON"]) : new Set(["REGULAR", "PLAYOFF"]);
      const disappearedKeys = schedule.season ? rows.filter((row) => row.season_year === schedule.season.year && activePhases.has(row.schedule_phase) && row.status !== "CANCELLED" && new Date(row.deadline) > refreshedAt && !evidenceKeys.has(`${row.season_year}:${row.schedule_phase}:${row.round}`)).map((row) => `${row.season_year}:${row.schedule_phase}:${row.round}`) : [];
      const reconciled = reconcileEvents({ existing: rows.map(eventView), evidence: schedule.evidence || [], invalidKeys: [...new Set([...(schedule.invalidKeys || []), ...disappearedKeys])], now: refreshedAt });
      for (const change of reconciled.changes) {
        const values = { deadline: change.deadline, status: change.status, sequence: change.sequence, source_hash: change.sourceHash, last_published_at: change.revisedAt || refreshedAt, cancelled_at: change.cancelledAt || null };
        const row = rows.find((candidate) => candidate.season_year === change.year && candidate.schedule_phase === change.phase && candidate.round === change.round);
        if (row) await row.update(values, { transaction });
        else await Event.create({ ...values, league_season_id: schedule.season.id, season_year: change.year, schedule_phase: change.phase, round: change.round, event_uid: stableEventUid(change), first_published_at: refreshedAt }, { transaction });
      }
      const currentRows = await Event.findAll({ transaction, lock: transaction.LOCK.UPDATE });
      const content = serializeCalendar({ events: visibleEvents(currentRows.map(eventView), refreshedAt), dashboardUrl: configuration.dashboardUrl });
      const contentHash = digest(content);
      if (!state) state = await FeedState.create({ id: STATE_ID, content, content_hash: contentHash, last_modified_at: refreshedAt, last_trustworthy_refresh_at: refreshedAt, state_version: 0 }, { transaction });
      else if (state.content_hash !== contentHash) await state.update({ content, content_hash: contentHash, last_modified_at: refreshedAt, last_trustworthy_refresh_at: refreshedAt, state_version: state.state_version + 1 }, { transaction });
      else await state.update({ last_trustworthy_refresh_at: refreshedAt }, { transaction });
      const counts = { created: reconciled.changes.filter((item) => item.kind === "CREATE").length, updated: reconciled.changes.filter((item) => item.kind === "UPDATE").length, cancelled: reconciled.changes.filter((item) => item.kind === "CANCEL").length };
      if (Object.values(counts).some((count) => count > 0)) logger.info("calendar_refresh_committed", counts);
      return { status: reconciled.changes.length ? "CHANGED" : "UNCHANGED" };
    });
  }

  async function getFeed({ available }) {
    const state = await FeedState.findByPk(STATE_ID);
    if (!available) return { content: emptyContent, contentHash: emptyHash, lastModified: state?.last_modified_at || new Date(0), state: "DISABLED" };
    if (!state) return { content: emptyContent, contentHash: emptyHash, lastModified: new Date(0), state: "EMPTY" };
    return { content: state.content, contentHash: state.content_hash, lastModified: state.last_modified_at, state: "TRUSTWORTHY" };
  }

  async function cleanup() {
    const cutoff = new Date(now().getTime() - HISTORY_MS);
    return database.transaction(async (transaction) => {
      const rows = await Event.findAll({ where: { [Op.or]: [{ status: "CONFIRMED", deadline: { [Op.lt]: cutoff } }, { status: "CANCELLED", cancelled_at: { [Op.lt]: cutoff } }] }, order: [["id", "ASC"]], limit: CLEANUP_BATCH, transaction, lock: transaction.LOCK.UPDATE });
      if (rows.length) await Event.destroy({ where: { id: rows.map((row) => row.id) }, transaction });
      return { deleted: rows.length };
    });
  }

  return { cleanup, getFeed, refresh };
}
module.exports = { CLEANUP_BATCH, createCalendarService, digest };
