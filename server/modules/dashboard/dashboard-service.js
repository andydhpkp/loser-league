const pickLeagueService = require("../picks/league-service");
const { dashboardSummary } = require("./dashboard-policy");
const { getPickRemindersAccess } = require("../../features/feature-access-service");

async function getSummary({ userId, featureConfiguration = {} }) {
  const [state, access] = await Promise.all([
    pickLeagueService.getSubmissionState({ userId }),
    getPickRemindersAccess({ userId, systemAvailable: featureConfiguration.pickRemindersSystemAvailable }),
  ]);
  return dashboardSummary(state, { pickReminders: access.effective });
}

module.exports = { getSummary };
