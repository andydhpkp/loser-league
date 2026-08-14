const { sequelize, User } = require("../../../models");
function createEmailReminderProvider({ emailService, transport, providerHealth }) {
  return { async send(intent, { claim }) {
    if (intent.kind !== "PICK_REMINDER" || intent.channel !== "EMAIL" || intent.navigateTo !== "DASHBOARD") return { outcome: "PERMANENT_FAILURE" };
    const prepared = await sequelize.transaction(async (transaction) => {
      const eligibility = await emailService.deliveryEligibility({ userId: claim.userId, transaction }); if (!eligibility.eligible) return null;
      const user = await User.findByPk(claim.userId, { attributes: ["email"], transaction, lock: transaction.LOCK.UPDATE }); if (!user) return null;
      const optOutToken = await emailService.issueOptOut(claim.userId, transaction); return optOutToken ? { destination: user.email, optOutToken } : null;
    });
    if (!prepared) return { outcome: "PERMANENT_FAILURE" };
    const result = await transport.sendReminder(prepared);
    if (result.classification === "AUTHENTICATION_FAILURE") { await providerHealth.open(); return { outcome: "TEMPORARY_FAILURE" }; }
    return { outcome: result.classification };
  } };
}
module.exports = { createEmailReminderProvider };
