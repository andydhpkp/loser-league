const express = require("express");
const { requireAdmin } = require("./require-admin");

function createAdminBuybackRouter(service, { requestAutoPickEvaluation } = {}) {
  const router = express.Router();
  router.use(requireAdmin);
  router.use(async (_req, _res, next) => {
    try { if (requestAutoPickEvaluation) await requestAutoPickEvaluation(); next(); }
    catch (error) { next(error); }
  });
  router.get("/", async (req, res, next) => {
    try { res.json({ decisions: await service.listAdmin({ view: req.query.view }) }); }
    catch (error) { next(error); }
  });
  router.post("/direct/complete", async (req, res, next) => {
    try { res.json(await service.completeAdminDirect({ userId: req.body.userId, trackIds: req.body.trackIds, stateVersion: req.body.stateVersion, paymentConfirmed: req.body.paymentConfirmed })); }
    catch (error) { next(error); }
  });
  router.post("/:decisionId/complete", async (req, res, next) => {
    try { res.json(await service.resolveAdmin({ decisionId: req.params.decisionId, stateVersion: req.body.stateVersion, fulfilledTrackIds: req.body.fulfilledTrackIds, paymentConfirmed: req.body.paymentConfirmed })); }
    catch (error) { next(error); }
  });
  router.post("/:decisionId/cancel", async (req, res, next) => {
    try { res.json(await service.resolveAdmin({ decisionId: req.params.decisionId, stateVersion: req.body.stateVersion, cancel: true })); }
    catch (error) { next(error); }
  });
  return router;
}

module.exports = { createAdminBuybackRouter };
