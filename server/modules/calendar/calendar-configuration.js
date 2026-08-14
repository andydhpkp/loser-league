const { exactHttpsOrigin } = require("../reminders/push-configuration");

function buildCalendarConfiguration(env = process.env) {
  const publicAppOrigin = exactHttpsOrigin(env.PUBLIC_APP_ORIGIN);
  const invalidSettings = [];
  if (env.PUBLIC_APP_ORIGIN !== undefined && !publicAppOrigin) invalidSettings.push("PUBLIC_APP_ORIGIN");
  return {
    ready: Boolean(publicAppOrigin),
    publicAppOrigin,
    feedUrl: publicAppOrigin ? `${publicAppOrigin}/calendar/pick-deadlines.ics` : null,
    dashboardUrl: publicAppOrigin ? `${publicAppOrigin}/dashboard.html` : null,
    invalidSettings,
  };
}
module.exports = { buildCalendarConfiguration };
