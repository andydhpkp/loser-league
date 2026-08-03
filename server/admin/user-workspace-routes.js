const express = require("express");
const { requireAdmin } = require("./require-admin");

function createAdminUserWorkspaceRouter({ inspectUserWorkspace }) {
  const router = express.Router();
  router.use(requireAdmin);
  router.get("/:userId/workspace", async (req, res, next) => {
    try {
      res.json(await inspectUserWorkspace(Number(req.params.userId)));
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = { createAdminUserWorkspaceRouter };
