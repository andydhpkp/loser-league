const express = require("express");
const { requireAdmin } = require("./require-admin");
const { getPickRemindersAccess } = require("../features/feature-access-service");

function createAdminUserWorkspaceRouter({ inspectUserWorkspace, getFeatureAccess = getPickRemindersAccess }) {
  const router = express.Router();
  router.use(requireAdmin);
  router.get("/:userId/workspace", async (req, res, next) => {
    try {
      const userId = Number(req.params.userId);
      const [workspace, access] = await Promise.all([inspectUserWorkspace(userId), getFeatureAccess({ userId, systemAvailable: false })]);
      res.json({ ...workspace, features: { pickRemindersBetaAccess: access.betaAccess } });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = { createAdminUserWorkspaceRouter };
