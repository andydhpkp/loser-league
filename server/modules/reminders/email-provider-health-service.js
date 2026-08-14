const { Transaction } = require("sequelize");
const { sequelize, EmailProviderHealth } = require("../../../models");
const PROVIDER_KEY = "GMAIL";
function createEmailProviderHealthService({ credentialVersion, logger = { warn() {}, info() {} } }) {
  async function readiness({ transaction } = {}) {
    const row = await EmailProviderHealth.findByPk(PROVIDER_KEY, { transaction });
    if (!row || row.state !== "OPEN") return { ready: true };
    if (row.opened_credential_version === credentialVersion) return { ready: false, reason: "EMAIL_BREAKER_OPEN" };
    await row.update({ state: "CLOSED", opened_at: null, opened_credential_version: null, state_version: row.state_version + 1 }, { transaction });
    logger.info("email_circuit_breaker_reset", {});
    return { ready: true };
  }
  async function open({ now = new Date() } = {}) {
    return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
      const [row] = await EmailProviderHealth.findOrCreate({ where: { provider_key: PROVIDER_KEY }, defaults: { state: "CLOSED" }, transaction });
      await row.reload({ transaction, lock: transaction.LOCK.UPDATE });
      if (row.state === "OPEN" && row.opened_credential_version === credentialVersion) return { opened: false };
      await row.update({ state: "OPEN", opened_at: now, opened_credential_version: credentialVersion, state_version: row.state_version + 1 }, { transaction });
      logger.warn("email_circuit_breaker_opened", { provider: PROVIDER_KEY });
      return { opened: true };
    });
  }
  return { open, readiness };
}
module.exports = { PROVIDER_KEY, createEmailProviderHealthService };
