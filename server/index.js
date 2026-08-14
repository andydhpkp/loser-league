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
const { buildPushConfiguration } = require("./modules/reminders/push-configuration");
const { createSubscriptionCryptography } = require("./modules/reminders/push-subscription-cryptography");
const { createPushSubscriptionService } = require("./modules/reminders/push-subscription-service");
const { createWebPushTransport } = require("./modules/reminders/web-push-provider");
const { createPushReminderProvider } = require("./modules/reminders/push-reminder-provider");
const webPush = require("web-push");
const nodemailer = require("nodemailer");
const { buildEmailConfiguration } = require("./modules/reminders/email-configuration");
const { createEmailTokenCryptography } = require("./modules/reminders/email-token-cryptography");
const { createGmailTransport } = require("./modules/reminders/gmail-transport");
const { createEmailTransports } = require("./modules/reminders/email-transports");
const { createEmailProviderHealthService } = require("./modules/reminders/email-provider-health-service");
const { createEmailReminderService } = require("./modules/reminders/email-reminder-service");
const { createEmailReminderProvider } = require("./modules/reminders/email-reminder-provider");
const { buildCalendarConfiguration } = require("./modules/calendar/calendar-configuration");
const { calculatePickReminderReadiness } = require("./features/pick-reminder-readiness");
const { createCalendarScheduleLoader } = require("./modules/calendar/calendar-schedule-loader");
const { createCalendarService } = require("./modules/calendar/calendar-service");
const { createCalendarCoordinator } = require("./modules/calendar/calendar-coordinator");

const PORT = process.env.PORT || 3001;
const logger = createLogger();
const sessionStore = new SequelizeStore({ db: sequelize });
const featureConfiguration = buildFeatureConfiguration();
const pushConfiguration = buildPushConfiguration();
const emailConfiguration = buildEmailConfiguration();
const calendarConfiguration = buildCalendarConfiguration();
const pushCryptography = pushConfiguration.ready ? createSubscriptionCryptography({ current: pushConfiguration.currentKey, previous: pushConfiguration.previousKey, digestKey: pushConfiguration.digestKey }) : null;
const pushSubscriptionService = pushConfiguration.ready ? createPushSubscriptionService({ cryptography: pushCryptography }) : null;
const loadAuthoritativeReminderContext = createAuthoritativeReminderContextLoader();
const emailCryptography = emailConfiguration.currentKey ? createEmailTokenCryptography({ current: emailConfiguration.currentKey, previous: emailConfiguration.previousKey }) : null;
const emailProviderHealth = emailConfiguration.credentialVersion ? createEmailProviderHealthService({ credentialVersion: emailConfiguration.credentialVersion, logger }) : null;
const gmailTransport = emailConfiguration.ready ? createGmailTransport({ nodemailer, configuration: emailConfiguration }) : null;
const emailTransports = gmailTransport ? createEmailTransports({ gmailTransport, configuration: emailConfiguration }) : null;
const unavailableEmailService = { status: async () => ({ state: "TEMPORARILY_UNAVAILABLE", maskedDestination: null, retryAfterSeconds: 0, hasPreviousRequest: false }), requestVerification: async () => ({ state: "TEMPORARILY_UNAVAILABLE" }), setEnabled: async () => ({ state: "TEMPORARILY_UNAVAILABLE", maskedDestination: null }), consumeVerification: async () => ({ success: false }), optOut: async () => ({ state: "USER_DISABLED" }), deliveryEligibility: async () => ({ eligible: false, reason: "EMAIL_UNAVAILABLE", defer: true }), cleanup: async () => ({ requestsDeleted: 0, optOutTokensDeleted: 0 }), operationalStatus: async () => ({ email: { state: "EMAIL_UNCONFIGURED", verified: 0, verification: {} } }) };
const emailReminderService = emailCryptography && emailProviderHealth ? createEmailReminderService({ cryptography: emailCryptography, setupTransport: emailTransports || { sendVerification: async () => ({ classification: "UNKNOWN" }) }, providerHealth: emailProviderHealth, configuration: emailConfiguration, logger }) : unavailableEmailService;
const providers = {};
if (pushConfiguration.ready) providers.PUSH = createPushReminderProvider({ cryptography: pushCryptography, transport: createWebPushTransport({ webPush, configuration: pushConfiguration }), configuration: pushConfiguration });
if (emailConfiguration.ready) providers.EMAIL = createEmailReminderProvider({ emailService: emailReminderService, transport: emailTransports, providerHealth: emailProviderHealth });
const reminderService = createReminderService({
  loadAuthoritativeContext: loadAuthoritativeReminderContext,
  configuration: featureConfiguration,
  logger,
  providers,
  channelGuard: async ({ channel, userId, transaction }) => channel === "EMAIL" ? emailReminderService?.deliveryEligibility({ userId, transaction }) || { eligible: false, reason: "EMAIL_UNAVAILABLE", defer: true } : { eligible: true },
  ancillaryCleanup: ({ limit }) => emailReminderService?.cleanup({ limit }) || {},
  ancillaryStatus: () => emailReminderService.operationalStatus(),
});
const reminderCoordinator = createReminderCoordinator({
  evaluate: reminderService.evaluateAutomatic,
  processDue: reminderService.processDue,
  cleanup: reminderService.cleanup,
  logger,
});
const calendarService = createCalendarService({ loadSchedule: createCalendarScheduleLoader(), configuration: calendarConfiguration, logger });
const calendarCoordinator = createCalendarCoordinator({ refresh: calendarService.refresh, cleanup: calendarService.cleanup, logger });
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
    calendarCoordinator.start();
  },
  stop() {
    autoPickCoordinator.stop();
    weekClosureCoordinator.stop();
    reminderCoordinator.stop();
    calendarCoordinator.stop();
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
  getReminderReleaseReadiness: async () => calculatePickReminderReadiness({ featureConfiguration, pushConfiguration, emailConfiguration, calendarConfiguration, providerChannels: Object.keys(providers) }),
  featureConfiguration,
  pushConfiguration,
  pushSubscriptionService,
  emailReminderService,
  emailConfiguration,
  calendarConfiguration,
  calendarService,
});

startServer({ app, database: sequelize, port: PORT, logger, lifecycleCoordinator })
  .catch((error) => {
    logger.error("server_start_failed", { errorType: error.name });
    process.exitCode = 1;
  });
