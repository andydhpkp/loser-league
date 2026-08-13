function buildFeatureConfiguration(env = process.env) {
  const raw = env.PICK_REMINDERS_SYSTEM_AVAILABLE;
  const valid = raw === undefined || raw === "true" || raw === "false";
  return {
    pickRemindersSystemAvailable: raw === "true",
    invalidSettings: valid ? [] : ["PICK_REMINDERS_SYSTEM_AVAILABLE"],
  };
}
module.exports = { buildFeatureConfiguration };
