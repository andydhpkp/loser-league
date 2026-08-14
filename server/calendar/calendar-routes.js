const express = require("express");
const { requireUser } = require("../user/require-user");

function quotedEtag(hash) { return `"${hash}"`; }
function notModified(req, etag, lastModified, { allowModifiedSince = true } = {}) {
  const match = req.get("if-none-match");
  if (match !== undefined) return match.split(",").map((value) => value.trim()).includes(etag) || match.trim() === "*";
  const since = req.get("if-modified-since");
  if (!since || !allowModifiedSince) return false;
  const parsed = new Date(since);
  return !Number.isNaN(parsed.getTime()) && Math.floor(lastModified.getTime() / 1000) <= Math.floor(parsed.getTime() / 1000);
}

function createPublicCalendarRouter({ service, available }) {
  const router = express.Router();
  router.get("/pick-deadlines.ics", async (req, res, next) => { try {
    const feed = await service.getFeed({ available: available() }); const etag = quotedEtag(feed.contentHash);
    res.set({ "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=300", ETag: etag, "Last-Modified": feed.lastModified.toUTCString() });
    if (notModified(req, etag, feed.lastModified, { allowModifiedSince: feed.state !== "DISABLED" })) return res.status(304).end();
    return res.status(200).send(feed.content);
  } catch (error) { return next(error); } });
  return router;
}

function createCalendarStatusRouter({ getAccess, featureConfiguration, calendarConfiguration }) {
  const router = express.Router(); router.use(requireUser); router.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
  router.get("/", async (req, res, next) => { try {
    const access = await getAccess({ userId: req.session.user_id, systemAvailable: featureConfiguration.pickRemindersSystemAvailable });
    if (!access.effective) return res.status(404).json({ code: "NOT_FOUND", message: "Calendar subscription is unavailable" });
    const available = featureConfiguration.pickRemindersCalendarAvailable === true && calendarConfiguration.ready;
    return res.json({ state: available ? "AVAILABLE" : "TEMPORARILY_UNAVAILABLE", subscriptionUrl: available ? calendarConfiguration.feedUrl : null, webcalUrl: available ? calendarConfiguration.feedUrl.replace(/^https:/, "webcal:") : null, subscriptionState: "LINK_PROVIDED", subscriptionCompletionDetectable: false });
  } catch (error) { return next(error); } });
  return router;
}
module.exports = { createCalendarStatusRouter, createPublicCalendarRouter, notModified, quotedEtag };
