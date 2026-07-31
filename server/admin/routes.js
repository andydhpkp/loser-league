const crypto = require("node:crypto");
const express = require("express");

const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function passwordDigest(password) {
  return crypto.createHash("sha256").update(password, "utf8").digest();
}

function passwordsMatch(submittedPassword, configuredPassword) {
  if (typeof submittedPassword !== "string" || submittedPassword.length === 0) {
    return false;
  }

  return crypto.timingSafeEqual(
    passwordDigest(submittedPassword),
    passwordDigest(configuredPassword)
  );
}

function createAdminRouter({ adminPassword }) {
  const router = express.Router();

  router.get("/session", (req, res) => {
    res.json({ authenticated: req.session.adminAuthenticated === true });
  });

  router.post("/login", (req, res, next) => {
    if (!passwordsMatch(req.body.password, adminPassword)) {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Incorrect admin password",
      });
      return;
    }

    req.session.regenerate((error) => {
      if (error) {
        next(error);
        return;
      }

      req.session.adminAuthenticated = true;
      req.session.cookie.maxAge = ADMIN_SESSION_MAX_AGE_MS;
      req.session.save((saveError) => {
        if (saveError) {
          next(saveError);
          return;
        }
        res.status(204).end();
      });
    });
  });

  router.post("/logout", (req, res, next) => {
    req.session.destroy((error) => {
      if (error) {
        next(error);
        return;
      }
      res.status(204).end();
    });
  });

  return router;
}

module.exports = { ADMIN_SESSION_MAX_AGE_MS, createAdminRouter };
