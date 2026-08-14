function calculatePickReminderReadiness({ featureConfiguration, pushConfiguration, emailConfiguration, calendarConfiguration, providerChannels = [] }) {
  const checks = {
    publicAppOrigin: Boolean(pushConfiguration?.publicAppOrigin && calendarConfiguration?.publicAppOrigin),
    masterControl: featureConfiguration?.pickRemindersSystemAvailable === true,
    pushControl: featureConfiguration?.pickRemindersPushDeliveryAvailable === true,
    pushConfiguration: pushConfiguration?.ready === true,
    pushAdapter: providerChannels.includes("PUSH"),
    emailControl: featureConfiguration?.pickRemindersEmailDeliveryAvailable === true,
    emailConfiguration: emailConfiguration?.ready === true,
    emailAdapter: providerChannels.includes("EMAIL"),
    calendarControl: featureConfiguration?.pickRemindersCalendarAvailable === true,
    calendarConfiguration: calendarConfiguration?.ready === true,
    settingsPage: true,
  };
  return { ready: Object.values(checks).every(Boolean), checks };
}

module.exports = { calculatePickReminderReadiness };
