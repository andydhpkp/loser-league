const { Transaction } = require("sequelize");
const { sequelize, PushSubscription, ReminderPreference } = require("../../../models");
const { validatePushSubscription } = require("./push-subscription-validation");
const { ConflictError } = require("../../lib/errors");

function createPushSubscriptionService({ cryptography, now = () => new Date() }) {
  async function count(userId, transaction) { return PushSubscription.count({ where: { user_id: userId, state: "ACTIVE" }, transaction }); }
  async function status({ userId, endpoint }) { const endpointDigest = endpoint ? cryptography.identity(endpoint) : null; const current = endpointDigest ? await PushSubscription.findOne({ where: { user_id: userId, endpoint_digest: endpointDigest, state: "ACTIVE" }, attributes: ["id"] }) : null; const deviceCount = await count(userId); return { state: current ? "ENABLED_CURRENT_DEVICE" : "SETUP_REQUIRED", currentDeviceEnabled: Boolean(current), deviceCount }; }
  async function register({ userId, subscription }) { const normalized = validatePushSubscription(subscription); const encrypted = cryptography.encrypt(normalized); const endpointDigest = cryptography.identity(normalized.endpoint); return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
    const existing = await PushSubscription.findOne({ where: { endpoint_digest: endpointDigest }, transaction, lock: transaction.LOCK.UPDATE });
    if (existing && existing.user_id !== userId) throw new ConflictError("This push subscription is already registered");
    await PushSubscription.upsert({ user_id: userId, endpoint_digest: endpointDigest, ciphertext: encrypted.ciphertext, nonce: encrypted.nonce, authentication_tag: encrypted.authenticationTag, key_version: encrypted.keyVersion, state: "ACTIVE", invalidated_at: null }, { transaction });
    const preference = await ReminderPreference.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (preference) await preference.update({ push_enabled: true, state_version: preference.state_version + 1 }, { transaction });
    else await ReminderPreference.create({ user_id: userId, email_enabled: false, push_enabled: true, state_version: 1 }, { transaction });
    return { state: "ENABLED_CURRENT_DEVICE", currentDeviceEnabled: true, deviceCount: await count(userId, transaction) };
  }); }
  async function disableCurrent({ userId, endpoint }) { const endpointDigest = cryptography.identity(endpoint); return sequelize.transaction(async (transaction) => { await PushSubscription.destroy({ where: { user_id: userId, endpoint_digest: endpointDigest }, transaction }); return { state: "SETUP_REQUIRED", currentDeviceEnabled: false, deviceCount: await count(userId, transaction) }; }); }
  async function disableAll({ userId }) { return sequelize.transaction(async (transaction) => { await PushSubscription.destroy({ where: { user_id: userId }, transaction }); const preference = await ReminderPreference.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE }); if (preference) await preference.update({ push_enabled: false, state_version: preference.state_version + 1 }, { transaction }); return { state: "USER_DISABLED", currentDeviceEnabled: false, deviceCount: 0 }; }); }
  async function invalidate({ id, transaction }) { return PushSubscription.update({ state: "INVALID", invalidated_at: now() }, { where: { id, state: "ACTIVE" }, transaction }); }
  return { disableAll, disableCurrent, invalidate, register, status };
}
module.exports = { createPushSubscriptionService };
