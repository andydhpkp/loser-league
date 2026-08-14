function buildFeatureConfiguration(env = process.env) {
  const settings = {
    PICK_REMINDERS_SYSTEM_AVAILABLE: "pickRemindersSystemAvailable",
    PICK_REMINDERS_EMAIL_DELIVERY_AVAILABLE: "pickRemindersEmailDeliveryAvailable",
    PICK_REMINDERS_PUSH_DELIVERY_AVAILABLE: "pickRemindersPushDeliveryAvailable",
    PICK_REMINDERS_ADMIN_CAMPAIGN_AVAILABLE: "pickRemindersAdminCampaignAvailable",
    PICK_REMINDERS_CALENDAR_AVAILABLE: "pickRemindersCalendarAvailable",
  };
  const invalidSettings = Object.keys(settings).filter((name) => env[name] !== undefined && env[name] !== "true" && env[name] !== "false");
  return {
    ...Object.fromEntries(Object.entries(settings).map(([name, property]) => [property, env[name] === "true"])),
    invalidSettings,
  };
}
module.exports = { buildFeatureConfiguration };
