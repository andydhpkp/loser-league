const { Transaction } = require("sequelize");
const { sequelize, PushSubscription, PushDeviceDelivery } = require("../../../models");
const { buildPushMessage } = require("./web-push-provider");
const DEVICE_LEASE_MS = 2 * 60 * 1000;

function aggregate(states) {
  if (states.includes("UNKNOWN")) return "UNKNOWN";
  if (states.includes("TEMPORARY_FAILURE")) return "TEMPORARY_FAILURE";
  if (states.includes("ACCEPTED")) return "ACCEPTED";
  return "PERMANENT_FAILURE";
}
function createPushReminderProvider({ cryptography, transport, configuration, now = () => new Date() }) {
  return { async send(intent, { claim, context }) {
    if (intent.kind !== "PICK_REMINDER" || intent.channel !== "PUSH" || intent.navigateTo !== "DASHBOARD") return { outcome: "PERMANENT_FAILURE" };
    const subscriptions = await PushSubscription.findAll({ where: { user_id: claim.userId, state: "ACTIVE" }, attributes: ["id", "ciphertext", "nonce", "authentication_tag", "key_version"] });
    if (!subscriptions.length) return { outcome: "PERMANENT_FAILURE" };
    const outcomes = [];
    for (const subscription of subscriptions) {
      const deviceClaim = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
        const [delivery] = await PushDeviceDelivery.findOrCreate({ where: { reminder_delivery_id: claim.id, push_subscription_id: subscription.id }, defaults: { state: "PENDING" }, transaction });
        await delivery.reload({ transaction, lock: transaction.LOCK.UPDATE });
        if (delivery.state === "ACCEPTED") return { terminal: "ACCEPTED" };
        if (["UNKNOWN", "PERMANENTLY_FAILED", "GONE"].includes(delivery.state)) return { terminal: delivery.state === "UNKNOWN" ? "UNKNOWN" : "PERMANENT_FAILURE" };
        if (delivery.state === "CLAIMED" && delivery.claimed_until <= now()) { await delivery.update({ state: "UNKNOWN", consumed_at: now(), claimed_until: null }, { transaction }); return { terminal: "UNKNOWN" }; }
        if (delivery.state === "CLAIMED") return { terminal: "UNKNOWN" };
        await delivery.update({ state: "CLAIMED", claim_version: delivery.claim_version + 1, claimed_until: new Date(now().getTime() + DEVICE_LEASE_MS) }, { transaction });
        return { id: delivery.id, version: delivery.claim_version, attemptCount: delivery.attempt_count };
      });
      if (deviceClaim.terminal) { outcomes.push(deviceClaim.terminal); continue; }
      let result;
      try {
        const plain = cryptography.decrypt({ ciphertext: subscription.ciphertext, nonce: subscription.nonce, authenticationTag: subscription.authentication_tag, keyVersion: subscription.key_version });
        const message = buildPushMessage({ now: now(), deadline: context.deadline, seasonYear: context.season.year, round: context.season.current_week, navigateUrl: `${configuration.publicAppOrigin}/dashboard.html` });
        ({ outcome: result } = await transport.send(plain, message));
      } catch (_error) { result = "UNKNOWN"; }
      const state = result === "GONE" ? "GONE" : result === "PERMANENT_FAILURE" ? "PERMANENTLY_FAILED" : result === "TEMPORARY_FAILURE" ? "TEMPORARILY_FAILED" : result;
      await sequelize.transaction(async (transaction) => {
        await PushDeviceDelivery.update({ state, attempt_count: deviceClaim.attemptCount + 1, claimed_until: null, consumed_at: ["ACCEPTED", "UNKNOWN", "PERMANENTLY_FAILED", "GONE"].includes(state) ? now() : null }, { where: { id: deviceClaim.id, state: "CLAIMED", claim_version: deviceClaim.version }, transaction });
        if (result === "GONE") await PushSubscription.update({ state: "INVALID", invalidated_at: now() }, { where: { id: subscription.id, state: "ACTIVE" }, transaction });
      });
      outcomes.push(result === "GONE" ? "PERMANENT_FAILURE" : result);
    }
    return { outcome: aggregate(outcomes) };
  } };
}
module.exports = { DEVICE_LEASE_MS, aggregate, createPushReminderProvider };
