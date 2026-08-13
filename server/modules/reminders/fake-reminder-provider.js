const { PROVIDER_OUTCOMES } = require("./reminder-delivery-policy");

function createFakeReminderProvider(outcomes = ["ACCEPTED"]) {
  const attempts = [];
  let index = 0;
  return {
    attempts,
    async send(intent) {
      attempts.push({ ...intent });
      const outcome = outcomes[Math.min(index, outcomes.length - 1)] || "UNKNOWN";
      index += 1;
      if (!PROVIDER_OUTCOMES.has(outcome)) throw new Error("Fake reminder provider outcome is invalid");
      return { outcome };
    },
  };
}

module.exports = { createFakeReminderProvider };
