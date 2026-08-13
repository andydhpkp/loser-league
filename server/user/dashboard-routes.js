const express = require("express");
const { requireUser } = require("./require-user");

function createDashboardRouter(service, { requestAutoPickEvaluation, featureConfiguration } = {}) {
  const router = express.Router();
  router.use(requireUser);
  router.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
  router.get("/", async (req, res, next) => {
    try { if (requestAutoPickEvaluation) await requestAutoPickEvaluation(); res.json(await service.getSummary({ userId: req.session.user_id, featureConfiguration })); }
    catch (error) { next(error); }
  });
  return router;
}

module.exports = { createDashboardRouter };
