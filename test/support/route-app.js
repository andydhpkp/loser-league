const express = require("express");

const { createApp } = require("../../server/app");
const sequelize = require("../../config/connection");
const { AdminAuditOperation, AdminAuditTarget } = require("../../models");

function createRouteApp(prefix, router) {
  const routes = express.Router();
  routes.use(prefix, router);
  return createApp({
    routes,
    sessionSecret: "unit-test-session-secret",
    adminPassword: "unit-test-admin-password",
    logger: {
      error() {},
      warn() {},
      info() {},
      debug() {},
    },
  });
}

function createAdminRouteApp(prefix, router) {
  const routes = express.Router();
  routes.use((req, _res, next) => {
    req.session.adminAuthenticated = true;
    next();
  });
  routes.use(prefix, router);
  return createApp({
    routes,
    sessionSecret: "unit-test-session-secret",
    adminPassword: "unit-test-admin-password",
    logger: { error() {}, warn() {}, info() {}, debug() {} },
  });
}

function mockLegacyEmergencyPersistence(t) {
  t.mock.method(sequelize, "transaction", async () => ({
    LOCK: { UPDATE: "UPDATE" },
    async commit() {},
    async rollback() {},
  }));
  t.mock.method(AdminAuditOperation, "create", async (values) => ({ id: 1, ...values }));
  t.mock.method(AdminAuditTarget, "bulkCreate", async (values) => values);
}

function createTrack(overrides = {}) {
  return {
    id: 7,
    user_id: 3,
    available_picks: ["Broncos", "Raiders", "Chiefs"],
    used_picks: ["Chargers"],
    current_pick: "Chargers",
    wrong_pick: null,
    User: { username: "alice" },
    async save() {
      return this;
    },
    async update(values) {
      Object.assign(this, values);
      return this;
    },
    ...overrides,
  };
}

module.exports = { createAdminRouteApp, createRouteApp, createTrack, mockLegacyEmergencyPersistence };
