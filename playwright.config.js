const { defineConfig } = require("@playwright/test");

const mobileProjects = [
  ["chromium-320", { width: 320, height: 568 }],
  ["chromium-375", { width: 375, height: 667 }],
  ["chromium-390", { width: 390, height: 844 }],
  ["chromium-412", { width: 412, height: 915 }],
].map(([name, viewport]) => ({
  name,
  ...(name === "chromium-390" ? {} : { testMatch: "mobile-layout.spec.js" }),
  use: { browserName: "chromium", viewport },
}));

const webkitProjects = process.env.MOBILE_WEBKIT === "1" ? [{
  name: "webkit-iphone",
  testMatch: "mobile-layout.spec.js",
  use: { browserName: "webkit", viewport: { width: 390, height: 844 } },
}] : [];

module.exports = defineConfig({
  testDir: "./test/smoke",
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    ...mobileProjects,
    ...webkitProjects,
    {
      name: "chromium-desktop",
      testMatch: "mobile-layout.spec.js",
      use: { browserName: "chromium", viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: {
    command: "node test/support/static-server.js",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: true,
  },
});
