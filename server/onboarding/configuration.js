const SETTINGS = {
  tatePhone: "ONBOARDING_TATE_PHONE",
  andrewPhone: "ONBOARDING_ANDREW_PHONE",
  venmoHandle: "ONBOARDING_VENMO_HANDLE",
  venmoUrl: "ONBOARDING_VENMO_URL",
};

function normalizePhone(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\+?[\d().\s-]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  return {
    formattedPhone: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`,
    smsUrl: `sms:+1${digits}`,
  };
}

function normalizePayment(handle, url) {
  if (typeof handle !== "string" || !/^@[A-Za-z0-9_-]+$/.test(handle)) return null;
  let parsed;
  try { parsed = new URL(url); } catch (_error) { return null; }
  const expectedPath = `/u/${handle.slice(1)}`;
  if (parsed.protocol !== "https:" || parsed.hostname !== "account.venmo.com" || parsed.pathname !== expectedPath || parsed.search || parsed.hash || parsed.username || parsed.password || parsed.port) return null;
  return { handle, url: parsed.href };
}

function buildOnboardingConfiguration(env = process.env) {
  const invalidSettings = [];
  const contacts = [];
  for (const [name, key] of [["Tate", SETTINGS.tatePhone], ["Andrew", SETTINGS.andrewPhone]]) {
    const phone = normalizePhone(env[key]);
    if (phone) contacts.push({ name, ...phone });
    else invalidSettings.push(key);
  }
  const payment = normalizePayment(env[SETTINGS.venmoHandle], env[SETTINGS.venmoUrl]);
  if (!payment) invalidSettings.push(SETTINGS.venmoHandle, SETTINGS.venmoUrl);
  return { presentation: { price: "$5", contacts, payment }, invalidSettings };
}

module.exports = { buildOnboardingConfiguration, normalizePhone, normalizePayment };
