const path = require("node:path");
const express = require("express");
const session = require("express-session");

const { UpstreamError } = require("./lib/errors");
const { createLogger } = require("./lib/logger");
const { createErrorHandler } = require("./middleware/error-handler");
const { requestContext } = require("./middleware/request-context");
const { createNflRouter } = require("./nfl/routes");

function createApp({
  routes,
  sessionSecret = process.env.SESSION_SECRET,
  oddsApiKey = process.env.ODDS_API_KEY,
  sessionStore,
  fetchImpl = global.fetch,
  logger = createLogger(),
} = {}) {
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required");
  }

  const app = express();

  app.use(requestContext);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, "../public")));
  app.use(
    session({
      secret: sessionSecret,
      cookie: { secure: false },
      resave: false,
      saveUninitialized: true,
      ...(sessionStore ? { store: sessionStore } : {}),
    })
  );

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
