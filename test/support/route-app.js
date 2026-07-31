const express = require("express");

const { createApp } = require("../../server/app");

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

module.exports = { createRouteApp, createTrack };
