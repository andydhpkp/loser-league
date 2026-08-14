const assert = require("node:assert/strict");
const test = require("node:test");

const { maskEmail, normalizeEmail } = require("../../server/modules/reminders/email-address");
const { createEmailTokenCryptography } = require("../../server/modules/reminders/email-token-cryptography");
const { buildEmailConfiguration } = require("../../server/modules/reminders/email-configuration");
const { buildReminderEmail, buildVerificationEmail } = require("../../server/modules/reminders/email-content");
const { classifySmtpResult } = require("../../server/modules/reminders/gmail-transport");
const { createGmailTransport } = require("../../server/modules/reminders/gmail-transport");
const { createEmailTransports } = require("../../server/modules/reminders/email-transports");

const key = Buffer.alloc(32, 9).toString("base64");

test("email normalization and masking preserve local identity safely", () => {
  assert.equal(normalizeEmail(" Alice+Picks@EXAMPLE.COM "), "Alice+Picks@example.com");
  assert.equal(normalizeEmail("user@éxample.test"), "user@xn--xample-9ua.test");
  assert.equal(maskEmail("a@example.com"), "a•••@example.com");
  assert.equal(maskEmail("ab@example.com"), "a•••@example.com");
  assert.equal(maskEmail('"odd.local"@example.com'), '"•••@example.com');
  assert.throws(() => maskEmail("not-an-address"));
});

test("email evidence and tokens are purpose-bound, one-way, and rotate", () => {
  const current = createEmailTokenCryptography({ current: { key, version: "v2" }, previous: { key: Buffer.alloc(32, 8).toString("base64"), version: "v1" }, randomBytes: () => Buffer.alloc(32, 4) });
  const token = current.issue("VERIFY");
  assert.equal(token.raw, Buffer.alloc(32, 4).toString("base64url"));
  assert.equal(token.digest.length, 64);
  assert.notEqual(current.digest("OPT_OUT", token.raw, "v2"), token.digest);
  assert.equal(current.matches("VERIFY", token.raw, token.digest, "v2"), true);
  assert.equal(current.matches("VERIFY", `${token.raw}x`, token.digest, "v2"), false);
  assert.equal(current.emailEvidence("Alice+Picks@EXAMPLE.COM").length, 64);
  assert.equal(current.emailEvidence("Alice+Picks@example.com"), current.emailEvidence("Alice+Picks@EXAMPLE.COM"));
});

test("email configuration fails closed and names invalid settings only", () => {
  assert.equal(buildEmailConfiguration({}).ready, false);
  const configuration = buildEmailConfiguration({
    PUBLIC_APP_ORIGIN: "https://example.test",
    PICK_REMINDERS_EMAIL_FROM: "loserleague.reminders@gmail.com",
    PICK_REMINDERS_EMAIL_REPLY_TO: "loserleague.reminders@gmail.com",
    PICK_REMINDERS_GMAIL_USER: "loserleague.reminders@gmail.com",
    PICK_REMINDERS_GMAIL_APP_PASSWORD: "test-only-placeholder",
    PICK_REMINDERS_GMAIL_CREDENTIAL_VERSION: "credential-v1",
    PICK_REMINDERS_EMAIL_TOKEN_KEY: key,
    PICK_REMINDERS_EMAIL_TOKEN_KEY_VERSION: "token-v1",
  });
  assert.equal(configuration.ready, true);
  assert.equal(configuration.publicAppOrigin, "https://example.test");
  assert.equal(configuration.invalidSettings.length, 0);
  const wrongSender = buildEmailConfiguration({ PICK_REMINDERS_EMAIL_FROM: "other@example.test" });
  assert.deepEqual(wrongSender.invalidSettings, ["PICK_REMINDERS_EMAIL_FROM"]);
});

test("verification and reminder email content is minimal and canonical", () => {
  const verification = buildVerificationEmail({ origin: "https://example.test", token: "safe-token" });
  assert.equal(verification.subject, "Verify Loser League email reminders");
  assert.match(verification.text, /https:\/\/example\.test\/reminders\/email\/verify\?token=safe-token/);
  assert.match(verification.text, /24 hours/);
  const reminder = buildReminderEmail({ origin: "https://example.test", optOutToken: "stop-token" });
  assert.equal(reminder.subject, "Loser League reminder");
  assert.match(reminder.text, /You may still have Picks to complete\. Open Loser League\./);
  assert.match(reminder.text, /https:\/\/example\.test\/dashboard\.html/);
  assert.match(reminder.text, /https:\/\/example\.test\/reminders\/email\/stop\?token=stop-token/);
  for (const forbidden of ["deadline", "track", "standings", "payment", "buyback", "pixel"]) assert.equal(reminder.text.toLowerCase().includes(forbidden), false);
});

test("SMTP outcomes distinguish auth, temporary, permanent, and ambiguous results", () => {
  assert.equal(classifySmtpResult({ info: { accepted: ["recipient"] } }), "ACCEPTED");
  assert.equal(classifySmtpResult({ error: { responseCode: 450 } }), "TEMPORARY_FAILURE");
  assert.equal(classifySmtpResult({ error: { responseCode: 454, code: "EAUTH" } }), "TEMPORARY_FAILURE");
  assert.equal(classifySmtpResult({ error: { responseCode: 550, response: "550 5.4.5 Daily user sending limit exceeded" } }), "TEMPORARY_FAILURE");
  assert.equal(classifySmtpResult({ error: { responseCode: 550, code: "EENVELOPE" } }), "PERMANENT_FAILURE");
  assert.equal(classifySmtpResult({ error: { code: "EAUTH", responseCode: 535 } }), "AUTHENTICATION_FAILURE");
  assert.equal(classifySmtpResult({ error: { code: "ETIMEDOUT" } }), "UNKNOWN");
  assert.equal(classifySmtpResult({ error: { code: "ECONNRESET" } }), "UNKNOWN");
});

test("Gmail transport uses authenticated TLS and returns sanitized classification only", async () => {
  let options; let message;
  const transport = createGmailTransport({ configuration: { gmailUser: "loserleague.reminders@gmail.com", gmailAppPassword: "synthetic-only" }, nodemailer: { createTransport(value) { options = value; return { async sendMail(input) { message = input; return { accepted: ["synthetic"] }; } }; } } });
  const result = await transport.send({ to: "synthetic@example.test", text: "minimal" });
  assert.equal(options.host, "smtp.gmail.com"); assert.equal(options.port, 465); assert.equal(options.secure, true); assert.equal(options.requireTLS, true); assert.equal(options.logger, false); assert.deepEqual(result, { classification: "ACCEPTED" }); assert.equal(message.text, "minimal");
});

test("email message transports provide plain text and disable external content access", async () => {
  let message; const transports = createEmailTransports({ configuration: { from: "loserleague.reminders@gmail.com", replyTo: "loserleague.reminders@gmail.com", publicAppOrigin: "https://example.test" }, gmailTransport: { async send(value) { message = value; return { classification: "ACCEPTED" }; } } });
  await transports.sendReminder({ destination: "synthetic@example.test", optOutToken: "synthetic-token" });
  assert.equal(message.html, undefined); assert.equal(message.disableFileAccess, true); assert.equal(message.disableUrlAccess, true); assert.equal(message.to, "synthetic@example.test");
});
