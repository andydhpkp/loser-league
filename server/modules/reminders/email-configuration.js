const { exactHttpsOrigin } = require("./push-configuration");
const APPROVED_ADDRESS = "loserleague.reminders@gmail.com";
function base64Key(value) { if (typeof value !== "string") return null; const bytes = Buffer.from(value, "base64"); return bytes.length === 32 && bytes.toString("base64") === value ? value : null; }
function version(value) { return typeof value === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : null; }
function buildEmailConfiguration(env = process.env) {
  const invalidSettings = [];
  const publicAppOrigin = exactHttpsOrigin(env.PUBLIC_APP_ORIGIN);
  const currentKey = base64Key(env.PICK_REMINDERS_EMAIL_TOKEN_KEY); const currentVersion = version(env.PICK_REMINDERS_EMAIL_TOKEN_KEY_VERSION);
  const previousKey = base64Key(env.PICK_REMINDERS_EMAIL_PREVIOUS_TOKEN_KEY); const previousVersion = version(env.PICK_REMINDERS_EMAIL_PREVIOUS_TOKEN_KEY_VERSION);
  for (const name of ["PICK_REMINDERS_EMAIL_FROM", "PICK_REMINDERS_EMAIL_REPLY_TO", "PICK_REMINDERS_GMAIL_USER"]) if (env[name] !== undefined && env[name] !== APPROVED_ADDRESS) invalidSettings.push(name);
  for (const [name, supplied, valid] of [
    ["PUBLIC_APP_ORIGIN", env.PUBLIC_APP_ORIGIN, publicAppOrigin], ["PICK_REMINDERS_GMAIL_APP_PASSWORD", env.PICK_REMINDERS_GMAIL_APP_PASSWORD, typeof env.PICK_REMINDERS_GMAIL_APP_PASSWORD === "string" && env.PICK_REMINDERS_GMAIL_APP_PASSWORD.length >= 8],
    ["PICK_REMINDERS_GMAIL_CREDENTIAL_VERSION", env.PICK_REMINDERS_GMAIL_CREDENTIAL_VERSION, version(env.PICK_REMINDERS_GMAIL_CREDENTIAL_VERSION)], ["PICK_REMINDERS_EMAIL_TOKEN_KEY", env.PICK_REMINDERS_EMAIL_TOKEN_KEY, currentKey], ["PICK_REMINDERS_EMAIL_TOKEN_KEY_VERSION", env.PICK_REMINDERS_EMAIL_TOKEN_KEY_VERSION, currentVersion],
  ]) if (supplied !== undefined && !valid) invalidSettings.push(name);
  if ((previousKey && !previousVersion) || (!previousKey && previousVersion) || (previousVersion && previousVersion === currentVersion)) invalidSettings.push("PICK_REMINDERS_EMAIL_PREVIOUS_TOKEN_KEY");
  const ready = invalidSettings.length === 0 && Boolean(publicAppOrigin && currentKey && currentVersion && env.PICK_REMINDERS_GMAIL_APP_PASSWORD && version(env.PICK_REMINDERS_GMAIL_CREDENTIAL_VERSION) && [env.PICK_REMINDERS_EMAIL_FROM, env.PICK_REMINDERS_EMAIL_REPLY_TO, env.PICK_REMINDERS_GMAIL_USER].every((item) => item === APPROVED_ADDRESS));
  return { ready, invalidSettings: [...new Set(invalidSettings)], publicAppOrigin, from: ready ? APPROVED_ADDRESS : null, replyTo: ready ? APPROVED_ADDRESS : null, gmailUser: ready ? APPROVED_ADDRESS : null, gmailAppPassword: ready ? env.PICK_REMINDERS_GMAIL_APP_PASSWORD : null, credentialVersion: version(env.PICK_REMINDERS_GMAIL_CREDENTIAL_VERSION), currentKey: currentKey && currentVersion ? { key: currentKey, version: currentVersion } : null, previousKey: previousKey && previousVersion ? { key: previousKey, version: previousVersion } : null };
}
module.exports = { APPROVED_ADDRESS, buildEmailConfiguration };
