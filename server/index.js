const sequelize = require("../config/connection.js");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const { createApp } = require("./app");
const { createLogger } = require("./lib/logger");
const { startServer } = require("./start");

const PORT = process.env.PORT || 3001;
const logger = createLogger();
const sessionStore = new SequelizeStore({ db: sequelize });
const app = createApp({ sessionStore, logger });

startServer({ app, database: sequelize, port: PORT, logger })
  .catch((error) => {
    logger.error("server_start_failed", { errorType: error.name });
    process.exitCode = 1;
  });
