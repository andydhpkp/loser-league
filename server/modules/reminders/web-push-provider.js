const { ValidationError } = require("../../lib/errors");
const TITLE = "Loser League reminder";
const BODY = "You may still have Picks to complete. Open Loser League.";
function buildPushMessage({ now, deadline, seasonYear, round, navigateUrl }) {
  const milliseconds = deadline?.getTime() - now?.getTime();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) throw new ValidationError("Push deadline has passed");
  const topic = `ll-${seasonYear}-${round}`;
  if (!/^ll-\d{4}-\d{1,2}$/.test(topic) || topic.length > 32) throw new ValidationError("Push topic is invalid");
  return { payload: JSON.stringify({ web_push: 8030, notification: { title: TITLE, body: BODY, navigate: navigateUrl, app_badge: "1" } }), options: { TTL: Math.floor(milliseconds / 1000), topic, urgency: "normal" } };
}
function classifyWebPushResult({ statusCode, error } = {}) {
  if (error) return ["ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"].includes(error.code) ? "UNKNOWN" : "TEMPORARY_FAILURE";
  if (statusCode >= 200 && statusCode < 300) return "ACCEPTED";
  if (statusCode === 404 || statusCode === 410) return "GONE";
  if ([401, 403, 408, 429].includes(statusCode) || statusCode >= 500) return "TEMPORARY_FAILURE";
  return "PERMANENT_FAILURE";
}
function providerFamily(subscription) {
  try {
    const hostname = new URL(subscription.endpoint).hostname;
    if (hostname === "web.push.apple.com") return "APPLE";
    if (hostname.endsWith(".googleapis.com")) return "GOOGLE";
    if (hostname.endsWith(".mozilla.com")) return "MOZILLA";
  } catch (_error) {}
  return "OTHER";
}
function allowlistedReason(error) {
  if (error?.statusCode === 401 || error?.statusCode === 403) {
    try {
      if (JSON.parse(error.body)?.reason === "BadJwtToken") return "BAD_JWT_TOKEN";
    } catch (_error) {}
    return "AUTHORIZATION_REJECTED";
  }
  return "UNSPECIFIED";
}
function createWebPushTransport({ webPush, configuration, logger }) {
  if (!configuration.ready) return { async send() { return { outcome: "PERMANENT_FAILURE" }; } };
  webPush.setVapidDetails(configuration.vapidSubject, configuration.vapidPublicKey, configuration.vapidPrivateKey);
  return { async send(subscription, message) { try { const response = await webPush.sendNotification(subscription, message.payload, message.options); return { outcome: classifyWebPushResult({ statusCode: response.statusCode }) }; } catch (error) {
    const outcome = classifyWebPushResult({ statusCode: error.statusCode, error: error.statusCode ? null : error });
    const provider = providerFamily(subscription);
    const reason = allowlistedReason(error);
    if (Number.isInteger(error.statusCode)) logger?.warn("push_provider_rejected", { provider, status: error.statusCode, reason, outcome });
    if (provider === "APPLE" && error.statusCode === 403 && reason === "BAD_JWT_TOKEN" && configuration.publicAppOrigin) {
      try {
        const response = await webPush.sendNotification(subscription, message.payload, { ...message.options, vapidDetails: { subject: configuration.publicAppOrigin, publicKey: configuration.vapidPublicKey, privateKey: configuration.vapidPrivateKey } });
        const retryOutcome = classifyWebPushResult({ statusCode: response.statusCode });
        logger?.info("push_provider_authorization_recovered", { provider, outcome: retryOutcome });
        return { outcome: retryOutcome };
      } catch (retryError) {
        const retryOutcome = classifyWebPushResult({ statusCode: retryError.statusCode, error: retryError.statusCode ? null : retryError });
        if (Number.isInteger(retryError.statusCode)) logger?.warn("push_provider_recovery_rejected", { provider, status: retryError.statusCode, reason: allowlistedReason(retryError), outcome: retryOutcome });
        return { outcome: retryOutcome };
      }
    }
    return { outcome };
  } } };
}
module.exports = { BODY, TITLE, buildPushMessage, classifyWebPushResult, createWebPushTransport };
