const path = require("node:path");
const express = require("express");
const session = require("express-session");

const { createAdminRouter } = require("./admin/routes");
const { createAdminActionRouter } = require("./admin/action-routes");
const { createAdminRepairRouter } = require("./admin/repair-routes");
const { createPickSubmissionRouter } = require("./user/pick-submission-routes");
const pickLeagueService = require("./modules/picks/league-service");
const { UpstreamError } = require("./lib/errors");
const { createLogger } = require("./lib/logger");
const { createErrorHandler } = require("./middleware/error-handler");
const { requestContext } = require("./middleware/request-context");
const { createNflRouter } = require("./nfl/routes");
const { createDefaultManualClosureContextLoader } = require("./modules/week-closure/manual-closure-context");
const { inspectTrack } = require("./modules/admin-repairs/inspector-service");

function createApp({
  routes,
  sessionSecret = process.env.SESSION_SECRET,
  adminPassword = process.env.ADMIN_PASSWORD,
  oddsApiKey = process.env.ODDS_API_KEY,
  sessionStore,
  fetchImpl = global.fetch,
  logger = createLogger(),
  requestClosureEvaluation,
  inspectAdminTrack = inspectTrack,
} = {}) {
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required");
  }
  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD is required");
  }

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
  app.use(express.static(path.join(__dirname, "../public")));
  app.use(sessionMiddleware);
  app.use("/api/admin", createAdminRouter({ adminPassword }));
  app.use("/api/admin/actions", createAdminActionRouter({
    requestClosureEvaluation,
    loadManualClosureContext: createDefaultManualClosureContextLoader({ fetchImpl }),
  }));
  app.use("/api/admin/repairs", createAdminRepairRouter({ inspectTrack: inspectAdminTrack }));
  app.use("/api/user/league", createPickSubmissionRouter({
    getSubmissionState: pickLeagueService.getSubmissionState,
    getLeagueView: pickLeagueService.getLeagueView,
    submit: (input) => pickLeagueService.submit({ ...input, fetchImpl }),
  }));

  app.get("/api/proxy/nfl-2025", async (_req, res, next) => {
    try {
      const response = await fetchImpl(
        "https://fixturedownload.com/feed/json/nfl-2025",
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LoserLeague/1.0)",
            Accept: "application/json",
            Referer: "https://loser-league.herokuapp.com",
          },
        }
      );

      if (!response.ok) {
        throw new UpstreamError();
      }

      res.json(await response.json());
    } catch (error) {
      next(
        error instanceof UpstreamError
          ? error
          : new UpstreamError(undefined, error)
      );
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
