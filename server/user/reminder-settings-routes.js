const express = require("express");
const { requireUser } = require("./require-user");

function createReminderSettingsPageRouter({ getAccess, featureConfiguration, pagePath }) {
  const router = express.Router();
  router.get("/reminder-settings.html", (req, res, next) => {
    if (req.session?.loggedIn !== true || !Number.isInteger(req.session.user_id)) {
      res.redirect("/index.html?returnTo=%2Freminder-settings.html");
      return;
    }
    next();
  }, requireUser, async (req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    try {
      const access = await getAccess({ userId: req.session.user_id, systemAvailable: featureConfiguration.pickRemindersSystemAvailable });
      if (!access.effective) return res.status(404).type("text").send("Pick Reminder Settings are unavailable.");
      return res.sendFile(pagePath);
    } catch (error) { return next(error); }
  });
  return router;
}

module.exports = { createReminderSettingsPageRouter };
