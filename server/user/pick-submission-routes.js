const express = require("express");
const { requireUser } = require("./require-user");

function createPickSubmissionRouter(service, { requestAutoPickEvaluation } = {}) {
  const router = express.Router();
  router.use(requireUser);
  router.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
  router.get("/submission", async (req, res, next) => {
    try { if (requestAutoPickEvaluation) await requestAutoPickEvaluation(); res.json(await service.getSubmissionState({ userId: req.session.user_id })); }
    catch (error) { next(error); }
  });
  router.get("/support", async (_req, res, next) => {
    try { res.json(await service.getSupport()); }
    catch (error) { next(error); }
  });
  router.post("/submission", async (req, res, next) => {
    try { res.json(await service.submit({ userId: req.session.user_id, selections: req.body.selections })); }
    catch (error) { next(error); }
  });
  router.post("/buyback/request", async (req, res, next) => {
    try { res.json(await service.decideBuyback({ userId: req.session.user_id, action: "REQUEST", trackIds: req.body.trackIds, stateVersion: req.body.stateVersion })); }
    catch (error) { next(error); }
  });
  router.post("/buyback/decline", async (req, res, next) => {
    try { res.json(await service.decideBuyback({ userId: req.session.user_id, action: "DECLINE", stateVersion: req.body.stateVersion })); }
    catch (error) { next(error); }
  });
  router.get("/view", async (req, res, next) => {
    try { res.json(await service.getLeagueView({ userId: req.session.user_id })); }
    catch (error) { next(error); }
  });
  return router;
}

module.exports = { createPickSubmissionRouter };
