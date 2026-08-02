const pickLeagueService = require("../picks/league-service");
const { dashboardSummary } = require("./dashboard-policy");

async function getSummary({ userId }) {
  return dashboardSummary(await pickLeagueService.getSubmissionState({ userId }));
}

module.exports = { getSummary };
