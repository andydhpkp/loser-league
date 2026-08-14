const crypto = require("node:crypto");
const { normalizeEmail } = require("./email-address");

function createEmailTokenCryptography({ current, previous = null, randomBytes = crypto.randomBytes }) {
  const keys = new Map([current, previous].filter(Boolean).map(({ key, version }) => [version, Buffer.from(key, "base64")]));
  function digest(purpose, raw, version = current.version) {
    const key = keys.get(version);
    if (!key || !["VERIFY", "OPT_OUT", "EMAIL_EVIDENCE"].includes(purpose)) return null;
    return crypto.createHmac("sha256", key).update(`loser-league:${purpose}:v1\0${raw}`).digest("hex");
  }
  function issue(purpose) {
    const raw = randomBytes(32).toString("base64url");
    return { raw, digest: digest(purpose, raw), keyVersion: current.version };
  }
  function matches(purpose, raw, expected, version) {
    const actual = digest(purpose, raw, version);
    if (!actual || typeof expected !== "string" || actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  }
  return { digest, emailEvidence: (email, version = current.version) => digest("EMAIL_EVIDENCE", normalizeEmail(email), version), issue, matches };
}

module.exports = { createEmailTokenCryptography };
