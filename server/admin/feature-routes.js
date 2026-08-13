const express = require("express");
const { requireAdmin } = require("./require-admin");
const { getPickRemindersRelease } = require("../features/feature-access-service");

function createAdminFeatureRouter({ getRelease = getPickRemindersRelease } = {}) {
  const router = express.Router();
  router.use(requireAdmin);
  router.get("/", async (_req, res, next) => {
    try {
      res.json({ features: { pickReminders: await getRelease() } });
    } catch (error) { next(error); }
  });
  return router;
}
module.exports = { createAdminFeatureRouter };
