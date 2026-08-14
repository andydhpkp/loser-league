const assert = require("node:assert/strict");
const test = require("node:test");
const { buildPushConfiguration } = require("../../server/modules/reminders/push-configuration");
const { createSubscriptionCryptography } = require("../../server/modules/reminders/push-subscription-cryptography");
const { validatePushSubscription } = require("../../server/modules/reminders/push-subscription-validation");
const { buildPushMessage, classifyWebPushResult } = require("../../server/modules/reminders/web-push-provider");
const { aggregate } = require("../../server/modules/reminders/push-reminder-provider");

const key = Buffer.alloc(32, 7).toString("base64");
const subscription = { endpoint: "https://push.example.test/subscription/abc", expirationTime: null, keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) } };

test("push configuration fails closed and validates an exact HTTPS origin", () => {
  assert.equal(buildPushConfiguration({}).ready, false);
  assert.equal(buildPushConfiguration({ PUBLIC_APP_ORIGIN: "https://example.test/path" }).invalidSettings.includes("PUBLIC_APP_ORIGIN"), true);
  const configured = buildPushConfiguration({ PUBLIC_APP_ORIGIN: "https://example.test", PICK_REMINDERS_VAPID_PUBLIC_KEY: Buffer.alloc(65, 4).toString("base64url"), PICK_REMINDERS_VAPID_PRIVATE_KEY: Buffer.alloc(32, 5).toString("base64url"), PICK_REMINDERS_VAPID_SUBJECT: "mailto:owner@example.test", REMINDER_DATA_ENCRYPTION_KEY: key, REMINDER_DATA_ENCRYPTION_KEY_VERSION: "v1", PUSH_SUBSCRIPTION_DIGEST_KEY: key });
  assert.equal(configured.ready, true);
  assert.equal(configured.publicAppOrigin, "https://example.test");
});

test("subscription validation is strict and bounded", () => {
  assert.deepEqual(validatePushSubscription(subscription), subscription);
  assert.throws(() => validatePushSubscription({ ...subscription, userId: 4 }));
  assert.throws(() => validatePushSubscription({ ...subscription, endpoint: "http://push.example.test/x" }));
  assert.throws(() => validatePushSubscription({ ...subscription, endpoint: `https://push.example.test/${"x".repeat(2048)}` }));
});

test("AES-GCM protects the complete subscription and supports current/prior rotation", () => {
  const current = createSubscriptionCryptography({ current: { version: "v2", key }, previous: { version: "v1", key: Buffer.alloc(32, 6).toString("base64") }, digestKey: key });
  const encrypted = current.encrypt(subscription);
  assert.equal(encrypted.keyVersion, "v2");
  assert.deepEqual(current.decrypt(encrypted), subscription);
  assert.equal(current.identity(subscription.endpoint).length, 64);
  assert.throws(() => current.decrypt({ ...encrypted, authenticationTag: Buffer.alloc(16).toString("base64") }));
  assert.throws(() => current.decrypt({ ...encrypted, keyVersion: "unknown" }));
  assert.equal(JSON.stringify(encrypted).includes(subscription.endpoint), false);
});

test("push content, TTL, topic, and provider classifications are bounded", () => {
  const deadline = new Date("2026-09-11T00:00:00Z");
  const message = buildPushMessage({ now: new Date("2026-09-10T23:59:58.100Z"), deadline, seasonYear: 2026, round: 3, navigateUrl: "https://example.test/dashboard.html" });
  assert.equal(message.options.TTL, 1);
  assert.equal(message.options.topic, "ll-2026-3");
  assert.deepEqual(JSON.parse(message.payload), { web_push: 8030, notification: { title: "Loser League reminder", body: "You may still have Picks to complete. Open Loser League.", navigate: "https://example.test/dashboard.html" } });
  assert.throws(() => buildPushMessage({ now: deadline, deadline, seasonYear: 2026, round: 3, navigateUrl: "https://example.test/dashboard.html" }));
  assert.equal(classifyWebPushResult({ statusCode: 201 }), "ACCEPTED");
  assert.equal(classifyWebPushResult({ statusCode: 410 }), "GONE");
  assert.equal(classifyWebPushResult({ statusCode: 429 }), "TEMPORARY_FAILURE");
  assert.equal(classifyWebPushResult({ statusCode: 400 }), "PERMANENT_FAILURE");
  assert.equal(classifyWebPushResult({ error: { code: "ETIMEDOUT" } }), "UNKNOWN");
  assert.equal(aggregate(["ACCEPTED", "UNKNOWN"]), "UNKNOWN");
  assert.equal(aggregate(["ACCEPTED", "TEMPORARY_FAILURE"]), "TEMPORARY_FAILURE");
  assert.equal(aggregate(["ACCEPTED", "PERMANENT_FAILURE"]), "ACCEPTED");
});
