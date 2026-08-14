const express = require("express");
const { requireAdmin } = require("./require-admin");
const { listAdminActions } = require("./action-registry");
const { AdminAuditOperation, AdminAuditTarget } = require("../../models");

function defaultCreatePreview(...args) {
  return require("./action-service").createPreview(...args);
}

function defaultConfirmPreview(...args) {
  return require("./action-service").confirmPreview(...args);
}

function createAdminActionRouter({
  requestClosureEvaluation = async () => {},
  loadManualClosureContext,
  loadHistoricalResults,
  loadRolloverTargetSchedule,
  loadPreseasonWeeks,
  loadManualReminderContext,
  requestReminderEvaluation = async () => {},
  getReleaseReadiness = async () => ({ ready: false, checks: {} }),
  createActionPreview = defaultCreatePreview,
  confirmActionPreview = defaultConfirmPreview,
} = {}) {
  const router = express.Router();
  router.use(requireAdmin);

  router.get("/", (_req, res) => res.json({ actions: listAdminActions() }));
  router.get("/audit", async (_req, res, next) => {
    try {
      const operations = await AdminAuditOperation.findAll({
        include: [{ model: AdminAuditTarget, as: "targets" }],
        order: [["id", "DESC"]],
        limit: 100,
      });
      res.json({ operations });
    } catch (error) { next(error); }
  });
  router.post("/:action/preview", async (req, res, next) => {
    try {
      const manualClosureContext = req.params.action === "CLOSE_WEEK" ? await loadManualClosureContext() : undefined;
      const releaseReadiness = req.params.action === "SET_PICK_REMINDERS_PUBLIC_RELEASE" ? await getReleaseReadiness() : undefined;
      res.status(201).json(await createActionPreview(req.params.action, req.body, { manualClosureContext, loadHistoricalResults, loadRolloverTargetSchedule, loadPreseasonWeeks, loadManualReminderContext, releaseReadiness }));
    }
    catch (error) { next(error); }
  });
  router.post("/:action/confirm", async (req, res, next) => {
    try {
      const manualClosureContext = req.params.action === "CLOSE_WEEK" ? await loadManualClosureContext() : undefined;
      const releaseReadiness = req.params.action === "SET_PICK_REMINDERS_PUBLIC_RELEASE" ? await getReleaseReadiness() : undefined;
      const result = await confirmActionPreview(req.params.action, req.body.confirmationKey, req.body.note, { manualClosureContext, loadHistoricalResults, loadRolloverTargetSchedule, loadPreseasonWeeks, loadManualReminderContext, confirmationPhrase: req.body.confirmationPhrase, releaseReadiness });
      if (req.params.action === "SEND_PICK_REMINDERS") {
        res.json({ action: result.action, operationId: result.id, leagueSeason: result.league_season_id ? { id: result.league_season_id, round: result.week } : null, summary: result.summary });
      } else res.json(result);
      if (req.params.action === "OVERRIDE_GAME_RESULT") void requestClosureEvaluation();
      if (req.params.action === "SEND_PICK_REMINDERS") void requestReminderEvaluation();
    }
    catch (error) { next(error); }
  });
  return router;
}

module.exports = { createAdminActionRouter };
