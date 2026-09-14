const express = require("express");
const { requireAdmin } = require("./require-admin");
const { getLeaguePot } = require("../modules/pot/pot-service");

function createAdminPotRouter({ getPot = getLeaguePot } = {}) {
  const router = express.Router();
  router.use(requireAdmin);
  router.get("/", async (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    try { res.json(await getPot()); }
    catch (error) { next(error); }
  });
  return router;
}
module.exports = { createAdminPotRouter };
