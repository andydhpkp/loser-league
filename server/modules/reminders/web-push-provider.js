const { ValidationError } = require("../../lib/errors");
const TITLE = "Loser League reminder";
const BODY = "You may still have Picks to complete. Open Loser League.";
function buildPushMessage({ now, deadline, seasonYear, round, navigateUrl }) {
  const milliseconds = deadline?.getTime() - now?.getTime();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) throw new ValidationError("Push deadline has passed");
  const topic = `ll-${seasonYear}-${round}`;
  if (!/^ll-\d{4}-\d{1,2}$/.test(topic) || topic.length > 32) throw new ValidationError("Push topic is invalid");
  return { payload: JSON.stringify({ web_push: 8030, notification: { title: TITLE, body: BODY, navigate: navigateUrl } }), options: { TTL: Math.floor(milliseconds / 1000), topic, urgency: "normal" } };
}
function classifyWebPushResult({ statusCode, error } = {}) {
  if (error) return ["ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"].includes(error.code) ? "UNKNOWN" : "TEMPORARY_FAILURE";
  if (statusCode >= 200 && statusCode < 300) return "ACCEPTED";
  if (statusCode === 404 || statusCode === 410) return "GONE";
  if (statusCode === 408 || statusCode === 429 || statusCode >= 500) return "TEMPORARY_FAILURE";
  return "PERMANENT_FAILURE";
}
function createWebPushTransport({ webPush, configuration }) {
  if (!configuration.ready) return { async send() { return { outcome: "PERMANENT_FAILURE" }; } };
  webPush.setVapidDetails(configuration.vapidSubject, configuration.vapidPublicKey, configuration.vapidPrivateKey);
  return { async send(subscription, message) { try { const response = await webPush.sendNotification(subscription, message.payload, message.options); return { outcome: classifyWebPushResult({ statusCode: response.statusCode }) }; } catch (error) { return { outcome: classifyWebPushResult({ statusCode: error.statusCode, error: error.statusCode ? null : error }) }; } } };
}
module.exports = { BODY, TITLE, buildPushMessage, classifyWebPushResult, createWebPushTransport };
