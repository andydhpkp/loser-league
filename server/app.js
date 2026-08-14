const path = require("node:path");
const express = require("express");
const session = require("express-session");

const { createAdminRouter } = require("./admin/routes");
const { createAdminActionRouter } = require("./admin/action-routes");
const { createAdminRepairRouter } = require("./admin/repair-routes");
const { createAdminBuybackRouter } = require("./admin/buyback-routes");
const { createBulkTrackRouter } = require("./admin/bulk-track-routes");
const { createAdminLeagueSeasonRouter } = require("./admin/league-season-routes");
const { createAdminUserWorkspaceRouter } = require("./admin/user-workspace-routes");
const { createAdminFeatureRouter } = require("./admin/feature-routes");
const { createAdminReminderRouter } = require("./admin/reminder-routes");
const { createPickSubmissionRouter } = require("./user/pick-submission-routes");
const { createDashboardRouter } = require("./user/dashboard-routes");
const dashboardService = require("./modules/dashboard/dashboard-service");
const pickLeagueService = require("./modules/picks/league-service");
const { UpstreamError } = require("./lib/errors");
const { createLogger } = require("./lib/logger");
const { createErrorHandler } = require("./middleware/error-handler");
const { requestContext } = require("./middleware/request-context");
const { createNflRouter } = require("./nfl/routes");
const { createDefaultManualClosureContextLoader } = require("./modules/week-closure/manual-closure-context");
const { inspectTrack, inspectUserWorkspace } = require("./modules/admin-repairs/inspector-service");
const { createDefaultHistoricalResultsLoader } = require("./modules/admin-repairs/historical-results-context");
const { fetchFixtureSchedule, fetchPreseasonWeeks } = require("./nfl/fixture-download-client");
const { LeagueSeason } = require("../models");
const { buildOnboardingConfiguration } = require("./onboarding/configuration");
const buybackService = require("./modules/buyback/buyback-service");
const { buildFeatureConfiguration } = require("./features/configuration");
const { createPushRouter } = require("./user/push-routes");
const { getPickRemindersAccess } = require("./features/feature-access-service");
const { createEmailReminderRouter, createPublicEmailReminderRouter } = require("./user/email-reminder-routes");

function createApp({
  routes,
  sessionSecret = process.env.SESSION_SECRET,
  adminPassword = process.env.ADMIN_PASSWORD,
  oddsApiKey = process.env.ODDS_API_KEY,
  sessionStore,
  fetchImpl = global.fetch,
  logger = createLogger(),
  onboardingConfiguration = buildOnboardingConfiguration(),
  featureConfiguration = buildFeatureConfiguration(),
  pushConfiguration = { ready: false, vapidPublicKey: null },
  emailConfiguration = { ready: false, invalidSettings: [] },
  pushSubscriptionService,
  emailReminderService,
  requestClosureEvaluation,
  requestAutoPickEvaluation,
  requestReminderEvaluation,
  loadManualReminderContext,
  getReminderOperationalStatus = async () => ({ counts: {} }),
  inspectAdminTrack = inspectTrack,
  inspectAdminUserWorkspace = inspectUserWorkspace,
  userDashboardService = dashboardService,
  loadLeagueSeasonYear = async () => {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1 }, attributes: ["year"] });
    if (!season) throw new UpstreamError("League Season configuration is unavailable");
    return season.year;
  },
} = {}) {
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required");
  }
  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD is required");
  }
  if (onboardingConfiguration.invalidSettings.length) {
    logger.warn("onboarding_configuration_invalid", { invalidSettings: onboardingConfiguration.invalidSettings });
  }
  if (featureConfiguration.invalidSettings.length) logger.warn("feature_configuration_invalid", { invalidSettings: featureConfiguration.invalidSettings });
  if (pushConfiguration.invalidSettings?.length) logger.warn("push_configuration_invalid", { invalidSettings: pushConfiguration.invalidSettings });
  if (emailConfiguration.invalidSettings?.length) logger.warn("email_configuration_invalid", { invalidSettings: emailConfiguration.invalidSettings });

  const app = express();
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(requestContext);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  const sessionMiddleware = session({
    secret: sessionSecret,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    },
    resave: false,
    saveUninitialized: true,
    ...(sessionStore ? { store: sessionStore } : {}),
  });
  app.get("/admin.html", sessionMiddleware, (req, res) => {
    if (req.session.adminAuthenticated !== true) {
      res.redirect("/index.html");
      return;
    }
    res.sendFile(path.join(__dirname, "../public/admin.html"));
  });
  for (const page of ["dashboard.html", "help.html"]) {
    app.get(`/${page}`, sessionMiddleware, (req, res) => {
      if (req.session?.loggedIn !== true || !Number.isInteger(req.session.user_id)) {
        res.redirect("/index.html");
        return;
      }
      res.set("Cache-Control", "private, no-store");
      res.sendFile(path.join(__dirname, `../public/${page}`));
    });
  }
  if (emailReminderService) app.use("/reminders/email", createPublicEmailReminderRouter({ service: emailReminderService }));
  app.use(express.static(path.join(__dirname, "../public")));
  app.use(sessionMiddleware);
  app.use("/api/admin", createAdminRouter({ adminPassword }));
  app.use("/api/admin/actions", createAdminActionRouter({
    requestClosureEvaluation,
    loadManualClosureContext: createDefaultManualClosureContextLoader({ fetchImpl }),
    loadHistoricalResults: createDefaultHistoricalResultsLoader({ fetchImpl }),
    loadRolloverTargetSchedule: ({ year, week }) => fetchFixtureSchedule({ year, week, fetchImpl }),
    loadPreseasonWeeks: ({ year, now }) => fetchPreseasonWeeks({ year, now, fetchImpl }),
    loadManualReminderContext,
    requestReminderEvaluation,
  }));
  app.use("/api/admin/league-season", createAdminLeagueSeasonRouter());
  app.use("/api/admin/repairs", createAdminRepairRouter({ inspectTrack: inspectAdminTrack }));
  app.use("/api/admin/users", createAdminUserWorkspaceRouter({ inspectUserWorkspace: inspectAdminUserWorkspace }));
  app.use("/api/admin/features", createAdminFeatureRouter());
  app.use("/api/admin/reminders", createAdminReminderRouter({ getOperationalStatus: getReminderOperationalStatus }));
  app.use("/api/admin/buybacks", createAdminBuybackRouter(buybackService, { requestAutoPickEvaluation }));
  app.use("/api/admin/tracks/bulk", createBulkTrackRouter());
  app.use("/api/user/league", createPickSubmissionRouter({
    getSupport: async () => ({ contacts: onboardingConfiguration.presentation.contacts }),
    getSubmissionState: (input) => pickLeagueService.getSubmissionState({ ...input, onboardingPresentation: onboardingConfiguration.presentation }),
    getLeagueView: pickLeagueService.getLeagueView,
    submit: (input) => pickLeagueService.submit({ ...input, fetchImpl }),
    decideBuyback: (input) => pickLeagueService.decideBuyback({ ...input, fetchImpl }),
  }, { requestAutoPickEvaluation }));
  app.use("/api/user/dashboard", createDashboardRouter(userDashboardService, { requestAutoPickEvaluation, featureConfiguration }));
  if (pushSubscriptionService) app.use("/api/user/reminders/push", createPushRouter({ service: pushSubscriptionService, getAccess: getPickRemindersAccess, featureConfiguration, pushConfiguration }));
  if (emailReminderService) app.use("/api/user/reminders/email", createEmailReminderRouter({ service: emailReminderService, getAccess: getPickRemindersAccess, featureConfiguration }));

  app.get("/api/proxy/nfl", async (_req, res, next) => {
    try {
      const year = await loadLeagueSeasonYear();
      const response = await fetchImpl(`https://fixturedownload.com/feed/json/nfl-${year}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LoserLeague/1.0)",
          Accept: "application/json",
          Referer: "https://loser-league.herokuapp.com",
        },
      });
      if (!response.ok) throw new UpstreamError();
      res.json(await response.json());
    } catch (error) {
      next(error instanceof UpstreamError ? error : new UpstreamError(undefined, error));
    }
  });

  app.get("/api/proxy/nfl-odds", async (_req, res, next) => {
    try {
      if (!oddsApiKey) {
        throw new UpstreamError("NFL odds configuration is unavailable");
      }

      const upstreamUrl = new URL(
        "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/"
      );
      upstreamUrl.search = new URLSearchParams({
        apiKey: oddsApiKey,
        regions: "us",
        markets: "spreads",
        oddsFormat: "american",
        bookmakers: "draftkings",
      });

      const response = await fetchImpl(upstreamUrl);
      if (!response.ok) {
        throw new UpstreamError("NFL odds data is unavailable");
      }

      res.json(await response.json());
    } catch (error) {
      next(
        error instanceof UpstreamError
          ? error
          : new UpstreamError("NFL odds data is unavailable", error)
      );
    }
  });

  app.use("/api/nfl", createNflRouter({ fetchImpl }));
  app.use(routes || require("../controllers"));
  app.use(createErrorHandler(logger));

  return app;
}

module.exports = { createApp };
