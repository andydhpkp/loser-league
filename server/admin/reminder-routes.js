const express = require("express");
const { requireAdmin } = require("./require-admin");

function createAdminReminderRouter({ getOperationalStatus }) {
  const router = express.Router();
  router.use(requireAdmin);
  router.get("/", async (_req, res, next) => {
    try { res.json(await getOperationalStatus()); } catch (error) { next(error); }
  });
  return router;
}

module.exports = { createAdminReminderRouter };
