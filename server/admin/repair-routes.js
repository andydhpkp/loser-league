const express = require("express");
const { requireAdmin } = require("./require-admin");

function createAdminRepairRouter({ inspectTrack }) {
  const router = express.Router();
  router.use(requireAdmin);
  router.get("/tracks/:trackId", async (req, res, next) => {
    try {
      res.json(await inspectTrack(Number(req.params.trackId)));
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = { createAdminRepairRouter };
