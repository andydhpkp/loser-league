const { Op, Transaction } = require("sequelize");
const { sequelize, User, ReminderPreference, EmailReminderVerification, EmailVerificationRequest, EmailOptOutToken } = require("../../../models");
const { maskEmail } = require("./email-address");
const VERIFY_MS = 24 * 60 * 60 * 1000; const TEN_MINUTES_MS = 10 * 60 * 1000; const DAY_MS = 24 * 60 * 60 * 1000; const OPT_OUT_MS = 400 * DAY_MS;
function createEmailReminderService({ cryptography, setupTransport, providerHealth, configuration, now = () => new Date(), logger = { info() {} } }) {
  async function load(userId, transaction, lock = false) { return User.findByPk(userId, { attributes: ["id", "email"], include: [{ model: ReminderPreference, as: "reminderPreference", required: false }, { model: EmailReminderVerification, as: "emailReminderVerification", required: false }], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }); }
  function verified(user) { const row = user?.emailReminderVerification; return Boolean(row && row.email_digest === cryptography.emailEvidence(user.email, row.key_version)); }
  async function status(userId) {
    const user = await load(userId); if (!user) return { state: "OFF", maskedDestination: null };
    const health = configuration.ready ? await providerHealth.readiness() : { ready: false };
    const isVerified = verified(user); let state = "OFF";
    if (isVerified) state = user.reminderPreference?.email_enabled === true ? "ENABLED" : "USER_DISABLED";
    else {
      if (user.reminderPreference?.email_enabled) await user.reminderPreference.update({ email_enabled: false, state_version: user.reminderPreference.state_version + 1 });
      const pending = await EmailVerificationRequest.count({ where: { user_id: userId, consumed_at: null, superseded_at: null, expires_at: { [Op.gt]: now() } } });
      const attempted = pending || user.emailReminderVerification || await EmailVerificationRequest.count({ where: { user_id: userId } });
      state = pending ? "VERIFICATION_PENDING" : attempted ? "VERIFICATION_REQUIRED" : "OFF";
    }
    if (!configuration.ready || !health.ready) state = "TEMPORARILY_UNAVAILABLE";
    return { state, maskedDestination: maskEmail(user.email) };
  }
  async function requestVerification(userId) {
    if (!configuration.ready || !(await providerHealth.readiness()).ready) return { state: "TEMPORARILY_UNAVAILABLE" };
    const currentTime = now(); const issued = cryptography.issue("VERIFY"); let destination; let retryAfterSeconds = null;
    await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
      const user = await load(userId, transaction, true); if (!user) return;
      const recent = await EmailVerificationRequest.findAll({ where: { user_id: userId, createdAt: { [Op.gt]: new Date(currentTime.getTime() - DAY_MS) } }, order: [["createdAt", "DESC"]], transaction, lock: transaction.LOCK.UPDATE });
      const latest = recent[0];
      const tenMinuteRetry = latest ? Math.ceil((latest.createdAt.getTime() + TEN_MINUTES_MS - currentTime.getTime()) / 1000) : 0;
      const dayRetry = recent.length >= 5 ? Math.ceil((recent[4].createdAt.getTime() + DAY_MS - currentTime.getTime()) / 1000) : 0;
      retryAfterSeconds = Math.max(tenMinuteRetry, dayRetry, 0); if (retryAfterSeconds > 0) return;
      await EmailVerificationRequest.update({ superseded_at: currentTime, result: "SUPERSEDED" }, { where: { user_id: userId, consumed_at: null, superseded_at: null }, transaction });
      await EmailVerificationRequest.create({ user_id: userId, token_digest: issued.digest, email_digest: cryptography.emailEvidence(user.email), key_version: issued.keyVersion, expires_at: new Date(currentTime.getTime() + VERIFY_MS), result: "PENDING", createdAt: currentTime, updatedAt: currentTime }, { transaction, silent: true });
      destination = user.email;
    });
    if (retryAfterSeconds > 0) { logger.info("email_verification_rate_limited", {}); return { state: "RATE_LIMITED", retryAfterSeconds }; }
    if (!destination) return { state: "VERIFICATION_PENDING" };
    const result = await setupTransport.sendVerification({ destination, token: issued.raw });
    await EmailVerificationRequest.update({ sent_at: currentTime, result: result.classification }, { where: { token_digest: issued.digest } });
    if (result.classification === "AUTHENTICATION_FAILURE") await providerHealth.open({ now: currentTime });
    logger.info("email_verification_requested", { result: result.classification });
    return { state: "VERIFICATION_PENDING" };
  }
  async function findToken(Model, purpose, raw, transaction) { const versions = [configuration.currentKey, configuration.previousKey].filter(Boolean); const digests = versions.map(({ version }) => cryptography.digest(purpose, raw, version)); return Model.findOne({ where: { token_digest: digests }, transaction, lock: transaction?.LOCK.UPDATE }); }
  async function consumeVerification(raw) {
    const currentTime = now(); let success = false;
    await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
      const request = await findToken(EmailVerificationRequest, "VERIFY", raw, transaction); if (!request || request.consumed_at || request.superseded_at || request.expires_at <= currentTime) return;
      const user = await load(request.user_id, transaction, true); if (!user || request.email_digest !== cryptography.emailEvidence(user.email)) return;
      const existing = user.emailReminderVerification; const securityVersion = existing?.security_version || 1;
      await EmailReminderVerification.upsert({ user_id: user.id, email_digest: request.email_digest, key_version: configuration.currentKey.version, verified_at: currentTime, security_version: securityVersion, state_version: (existing?.state_version || 0) + 1 }, { transaction });
      await ReminderPreference.upsert({ user_id: user.id, email_enabled: true, push_enabled: user.reminderPreference?.push_enabled === true, state_version: (user.reminderPreference?.state_version || 0) + 1 }, { transaction });
      await request.update({ consumed_at: currentTime, result: "CONSUMED" }, { transaction }); success = true;
    });
    logger.info(success ? "email_verification_consumed" : "email_verification_rejected", {}); return { success };
  }
  async function setEnabled(userId, enabled) { return sequelize.transaction(async (transaction) => { const user = await load(userId, transaction, true); if (!user) return { state: "VERIFICATION_REQUIRED" }; const isVerified = verified(user); const value = enabled === true && isVerified; await ReminderPreference.upsert({ user_id: userId, email_enabled: value, push_enabled: user.reminderPreference?.push_enabled === true, state_version: (user.reminderPreference?.state_version || 0) + 1 }, { transaction }); return { state: value ? "ENABLED" : enabled ? "VERIFICATION_REQUIRED" : "USER_DISABLED", maskedDestination: maskEmail(user.email) }; }); }
  async function issueOptOut(userId, transaction) { const verification = await EmailReminderVerification.findByPk(userId, { transaction, lock: transaction?.LOCK.UPDATE }); if (!verification) return null; const issued = cryptography.issue("OPT_OUT"); await EmailOptOutToken.create({ user_id: userId, token_digest: issued.digest, key_version: issued.keyVersion, security_version: verification.security_version, expires_at: new Date(now().getTime() + OPT_OUT_MS) }, { transaction }); return issued.raw; }
  async function optOut(raw) { const currentTime = now(); await sequelize.transaction(async (transaction) => { const token = await findToken(EmailOptOutToken, "OPT_OUT", raw, transaction); if (!token || token.expires_at <= currentTime) return; const verification = await EmailReminderVerification.findByPk(token.user_id, { transaction, lock: transaction.LOCK.UPDATE }); if (!verification || verification.security_version !== token.security_version) return; const preference = await ReminderPreference.findByPk(token.user_id, { transaction, lock: transaction.LOCK.UPDATE }); if (preference?.email_enabled) await preference.update({ email_enabled: false, state_version: preference.state_version + 1 }, { transaction }); if (!token.used_at) await token.update({ used_at: currentTime }, { transaction }); }); return { state: "USER_DISABLED" }; }
  async function deliveryEligibility({ userId, transaction }) { if (!configuration.ready) return { eligible: false, reason: "EMAIL_UNAVAILABLE", defer: true }; const work = async (activeTransaction) => { const health = await providerHealth.readiness({ transaction: activeTransaction }); if (!health.ready) return { eligible: false, reason: health.reason, defer: true }; const user = await load(userId, activeTransaction, true); if (!user || !verified(user)) { if (user?.reminderPreference?.email_enabled) await user.reminderPreference.update({ email_enabled: false, state_version: user.reminderPreference.state_version + 1 }, { transaction: activeTransaction }); return { eligible: false, reason: "EMAIL_UNVERIFIED" }; } return { eligible: true }; }; return transaction ? work(transaction) : sequelize.transaction(work); }
  async function cleanup({ limit = 100 } = {}) { const currentTime = now(); return sequelize.transaction(async (transaction) => { const requests = await EmailVerificationRequest.findAll({ where: { [Op.or]: [{ expires_at: { [Op.lte]: currentTime } }, { superseded_at: { [Op.ne]: null } }] }, attributes: ["id"], limit, order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE }); const requestIds = requests.map(({ id }) => id); const requestsDeleted = requestIds.length ? await EmailVerificationRequest.destroy({ where: { id: requestIds }, transaction }) : 0; const remaining = Math.max(0, limit - requestsDeleted); const tokens = remaining ? await EmailOptOutToken.findAll({ where: { expires_at: { [Op.lte]: currentTime } }, attributes: ["id"], limit: remaining, order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE }) : []; const tokenIds = tokens.map(({ id }) => id); const optOutTokensDeleted = tokenIds.length ? await EmailOptOutToken.destroy({ where: { id: tokenIds }, transaction }) : 0; return { requestsDeleted, optOutTokensDeleted }; }); }
  async function operationalStatus() { const grouped = await EmailVerificationRequest.count({ group: ["result"] }); const verification = Object.fromEntries(grouped.map(({ result, count }) => [String(result).toLowerCase(), Number(count)])); const health = configuration.ready ? await providerHealth.readiness() : { ready: false, reason: "EMAIL_UNCONFIGURED" }; return { email: { state: health.ready ? "AVAILABLE" : health.reason, verified: await EmailReminderVerification.count(), verification } }; }
  return { cleanup, consumeVerification, deliveryEligibility, issueOptOut, operationalStatus, optOut, requestVerification, setEnabled, status };
}
module.exports = { DAY_MS, OPT_OUT_MS, TEN_MINUTES_MS, VERIFY_MS, createEmailReminderService };
