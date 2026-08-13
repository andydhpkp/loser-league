const sequelize = require("../config/connection.js");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const { createApp } = require("./app");
const { createLogger } = require("./lib/logger");
const { startServer } = require("./start");
const { createAutoPickCoordinator } = require("./modules/picks/auto-pick-coordinator");
const { createDefaultAutoPickEvaluator } = require("./modules/picks/auto-pick-evaluator");
const { createWeekClosureCoordinator } = require("./modules/week-closure/week-closure-coordinator");
const { createDefaultWeekClosureEvaluator } = require("./modules/week-closure/week-closure-evaluator");
const { buildFeatureConfiguration } = require("./features/configuration");
const { createReminderService } = require("./modules/reminders/reminder-service");
const { createAuthoritativeReminderContextLoader } = require("./modules/reminders/reminder-context");
const { createReminderCoordinator } = require("./modules/reminders/reminder-coordinator");

const PORT = process.env.PORT || 3001;
const logger = createLogger();
const sessionStore = new SequelizeStore({ db: sequelize });
const featureConfiguration = buildFeatureConfiguration();
const loadAuthoritativeReminderContext = createAuthoritativeReminderContextLoader();
const reminderService = createReminderService({
  loadAuthoritativeContext: loadAuthoritativeReminderContext,
  configuration: featureConfiguration,
  logger,
});
const reminderCoordinator = createReminderCoordinator({
  evaluate: reminderService.evaluateAutomatic,
  processDue: reminderService.processDue,
  cleanup: reminderService.cleanup,
  logger,
});
const autoPickCoordinator = createAutoPickCoordinator({
  evaluate: createDefaultAutoPickEvaluator(),
  logger,
});
const weekClosureCoordinator = createWeekClosureCoordinator({
  evaluate: createDefaultWeekClosureEvaluator(),
  logger,
});
const lifecycleCoordinator = {
  start() {
    autoPickCoordinator.start();
    weekClosureCoordinator.start();
    reminderCoordinator.start();
  },
  stop() {
    autoPickCoordinator.stop();
    weekClosureCoordinator.stop();
    reminderCoordinator.stop();
  },
};
const app = createApp({
  sessionStore,
  logger,
  requestClosureEvaluation: () => weekClosureCoordinator.evaluate(),
  requestAutoPickEvaluation: () => autoPickCoordinator.evaluate(),
  requestReminderEvaluation: () => reminderCoordinator.evaluate(),
  loadManualReminderContext: reminderService.buildManualCampaignContext,
  getReminderOperationalStatus: reminderService.getOperationalStatus,
  featureConfiguration,
});

startServer({ app, database: sequelize, port: PORT, logger, lifecycleCoordinator })
  .catch((error) => {
    logger.error("server_start_failed", { errorType: error.name });
    process.exitCode = 1;
  });
