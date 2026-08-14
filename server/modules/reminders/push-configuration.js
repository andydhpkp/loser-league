function exactHttpsOrigin(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value && !url.username && !url.password ? value : null;
  } catch (_error) { return null; }
}

function base64Key(value) {
  if (typeof value !== "string") return null;
  const bytes = Buffer.from(value, "base64");
  return bytes.length === 32 && bytes.toString("base64") === value ? value : null;
}
function vapidKey(value, bytes) { if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null; try { return Buffer.from(value, "base64url").length === bytes ? value : null; } catch (_error) { return null; } }

function buildPushConfiguration(env = process.env) {
  const invalidSettings = [];
  const publicAppOrigin = exactHttpsOrigin(env.PUBLIC_APP_ORIGIN);
  if (env.PUBLIC_APP_ORIGIN !== undefined && !publicAppOrigin) invalidSettings.push("PUBLIC_APP_ORIGIN");
  const currentKey = base64Key(env.REMINDER_DATA_ENCRYPTION_KEY);
  const digestKey = base64Key(env.PUSH_SUBSCRIPTION_DIGEST_KEY);
  const currentVersion = typeof env.REMINDER_DATA_ENCRYPTION_KEY_VERSION === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(env.REMINDER_DATA_ENCRYPTION_KEY_VERSION) ? env.REMINDER_DATA_ENCRYPTION_KEY_VERSION : null;
  const previousKey = base64Key(env.REMINDER_DATA_PREVIOUS_ENCRYPTION_KEY);
  const previousVersion = typeof env.REMINDER_DATA_PREVIOUS_ENCRYPTION_KEY_VERSION === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(env.REMINDER_DATA_PREVIOUS_ENCRYPTION_KEY_VERSION) ? env.REMINDER_DATA_PREVIOUS_ENCRYPTION_KEY_VERSION : null;
  for (const [name, supplied, valid] of [
    ["REMINDER_DATA_ENCRYPTION_KEY", env.REMINDER_DATA_ENCRYPTION_KEY, currentKey],
    ["REMINDER_DATA_ENCRYPTION_KEY_VERSION", env.REMINDER_DATA_ENCRYPTION_KEY_VERSION, currentVersion],
    ["PUSH_SUBSCRIPTION_DIGEST_KEY", env.PUSH_SUBSCRIPTION_DIGEST_KEY, digestKey],
  ]) if (supplied !== undefined && !valid) invalidSettings.push(name);
  if ((previousKey && !previousVersion) || (!previousKey && previousVersion) || previousVersion === currentVersion) invalidSettings.push("REMINDER_DATA_PREVIOUS_ENCRYPTION_KEY");
  const vapidSubject = typeof env.PICK_REMINDERS_VAPID_SUBJECT === "string" && /^(mailto:|https:)/.test(env.PICK_REMINDERS_VAPID_SUBJECT) ? env.PICK_REMINDERS_VAPID_SUBJECT : null;
  const vapidPublicKey = vapidKey(env.PICK_REMINDERS_VAPID_PUBLIC_KEY, 65); const vapidPrivateKey = vapidKey(env.PICK_REMINDERS_VAPID_PRIVATE_KEY, 32);
  for (const [name, supplied, valid] of [["PICK_REMINDERS_VAPID_PUBLIC_KEY", env.PICK_REMINDERS_VAPID_PUBLIC_KEY, vapidPublicKey], ["PICK_REMINDERS_VAPID_PRIVATE_KEY", env.PICK_REMINDERS_VAPID_PRIVATE_KEY, vapidPrivateKey], ["PICK_REMINDERS_VAPID_SUBJECT", env.PICK_REMINDERS_VAPID_SUBJECT, vapidSubject]]) if (supplied !== undefined && !valid) invalidSettings.push(name);
  const ready = invalidSettings.length === 0 && Boolean(publicAppOrigin && currentKey && currentVersion && digestKey && vapidPublicKey && vapidPrivateKey && vapidSubject);
  return { ready, invalidSettings: [...new Set(invalidSettings)], publicAppOrigin, vapidPublicKey: ready ? vapidPublicKey : null, vapidPrivateKey: ready ? vapidPrivateKey : null, vapidSubject: ready ? vapidSubject : null, currentKey: currentKey && currentVersion ? { key: currentKey, version: currentVersion } : null, previousKey: previousKey && previousVersion ? { key: previousKey, version: previousVersion } : null, digestKey };
}

module.exports = { buildPushConfiguration, exactHttpsOrigin };
