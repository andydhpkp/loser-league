const crypto = require("node:crypto");
const { ValidationError } = require("../../lib/errors");

function decodeKey(value) { const key = Buffer.from(value, "base64"); if (key.length !== 32) throw new Error("Reminder data encryption configuration is invalid"); return key; }
function createSubscriptionCryptography({ current, previous = null, digestKey }) {
  if (!current?.version || !current?.key || !digestKey || previous?.version === current.version) throw new Error("Reminder data encryption configuration is invalid");
  const keys = new Map([[current.version, decodeKey(current.key)]]);
  if (previous) keys.set(previous.version, decodeKey(previous.key));
  const identityKey = decodeKey(digestKey);
  return {
    identity(endpoint) { return crypto.createHmac("sha256", identityKey).update("loser-league:pick-reminders:push-endpoint:v1\0").update(endpoint).digest("hex"); },
    encrypt(subscription) {
      const nonce = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", keys.get(current.version), nonce);
      cipher.setAAD(Buffer.from(`push-subscription:${current.version}`));
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(subscription), "utf8"), cipher.final()]);
      return { ciphertext: ciphertext.toString("base64"), nonce: nonce.toString("base64"), authenticationTag: cipher.getAuthTag().toString("base64"), keyVersion: current.version };
    },
    decrypt(record) {
      const key = keys.get(record.keyVersion); if (!key) throw new ValidationError("Push subscription key version is unavailable");
      try { const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(record.nonce, "base64")); decipher.setAAD(Buffer.from(`push-subscription:${record.keyVersion}`)); decipher.setAuthTag(Buffer.from(record.authenticationTag, "base64")); return JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.ciphertext, "base64")), decipher.final()]).toString("utf8")); }
      catch (_error) { throw new ValidationError("Push subscription data is unavailable"); }
    },
  };
}
module.exports = { createSubscriptionCryptography };
