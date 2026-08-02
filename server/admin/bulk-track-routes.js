const express = require("express");
const { requireAdmin } = require("./require-admin");

function defaultCreate(additions) {
  return require("./bulk-track-service").createTracksInBulk(additions);
}

function createBulkTrackRouter({ createTracks = defaultCreate } = {}) {
  const router = express.Router();
  router.use(requireAdmin);
  router.post("/", async (req, res, next) => {
    try {
      res.status(201).json(await createTracks(req.body.additions));
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = { createBulkTrackRouter };
