const express = require("express");
const { requireAdmin } = require("./require-admin");
const { listAdminActions } = require("./action-registry");
const { confirmPreview, createPreview } = require("./action-service");
const { AdminAuditOperation, AdminAuditTarget } = require("../../models");

function createAdminActionRouter({ requestClosureEvaluation = async () => {}, loadManualClosureContext } = {}) {
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
      res.status(201).json(await createPreview(req.params.action, req.body, { manualClosureContext }));
    }
    catch (error) { next(error); }
  });
  router.post("/:action/confirm", async (req, res, next) => {
    try {
      const manualClosureContext = req.params.action === "CLOSE_WEEK" ? await loadManualClosureContext() : undefined;
      const result = await confirmPreview(req.params.action, req.body.confirmationKey, req.body.note, { manualClosureContext });
      res.json(result);
      if (req.params.action === "OVERRIDE_GAME_RESULT") void requestClosureEvaluation();
    }
    catch (error) { next(error); }
  });
  return router;
}

module.exports = { createAdminActionRouter };
