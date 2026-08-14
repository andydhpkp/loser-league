const { ValidationError } = require("../../lib/errors");
const MAX_ENDPOINT = 2048;

function validatePushSubscription(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !["endpoint", "expirationTime", "keys"].includes(key))) throw new ValidationError("Push subscription is invalid");
  if (typeof value.endpoint !== "string" || value.endpoint.length < 1 || value.endpoint.length > MAX_ENDPOINT) throw new ValidationError("Push subscription is invalid");
  try { if (new URL(value.endpoint).protocol !== "https:") throw new Error(); } catch (_error) { throw new ValidationError("Push subscription is invalid"); }
  if (value.expirationTime !== null && value.expirationTime !== undefined && (!Number.isSafeInteger(value.expirationTime) || value.expirationTime < 0)) throw new ValidationError("Push subscription is invalid");
  if (!value.keys || typeof value.keys !== "object" || Array.isArray(value.keys) || Object.keys(value.keys).sort().join(",") !== "auth,p256dh") throw new ValidationError("Push subscription is invalid");
  if (typeof value.keys.p256dh !== "string" || value.keys.p256dh.length < 40 || value.keys.p256dh.length > 256 || typeof value.keys.auth !== "string" || value.keys.auth.length < 16 || value.keys.auth.length > 128) throw new ValidationError("Push subscription is invalid");
  return { endpoint: value.endpoint, expirationTime: value.expirationTime ?? null, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } };
}
module.exports = { MAX_ENDPOINT, validatePushSubscription };
