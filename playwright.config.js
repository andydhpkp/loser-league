const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./test/smoke",
  use: {
    baseURL: "http://127.0.0.1:4173",
  },
  webServer: {
    command: "node test/support/static-server.js",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: true,
  },
});
