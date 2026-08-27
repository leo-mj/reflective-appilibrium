import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end config.
 *
 * The suite drives the real SPA in a browser, so it needs a dev server. Rather
 * than expecting one to be up, `webServer` starts vite itself and waits for the
 * port — and reuses a server you already have running locally, so a manual
 * `npm run dev` is never killed out from under you.
 *
 * VITE_APP_ENV is pinned to "demo" so the run is deterministic: demo turns off
 * the backend, the LLM, and BYOK, which is also what a fresh CI checkout gets
 * (app/.env is gitignored, and an unset VITE_APP_ENV disables the same three
 * flags). Without pinning it, a developer whose .env says "backend" would see
 * the Saved-sessions card appear and the assist tabs hit a real API.
 */
const PORT = 5173;

export default defineConfig({
  testDir: "./e2e",
  // Vitest owns *.test.js; Playwright owns *.spec.js. Keeping the extensions
  // disjoint means neither runner ever tries to execute the other's files.
  testMatch: /.*\.spec\.js/,

  // A failing E2E test is far more often a flake or a real bug than a fluke of
  // timing, so retry only on CI, where a rerun is cheaper than a red build.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }], ["list"]]
    : [["list"]],

  use: {
    baseURL: `http://localhost:${PORT}/`,
    // Artefacts only for failures — a green run should leave nothing behind.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      // responsive.spec.js asserts the narrow layout; running it at 1440px
      // would fail on assertions that are only meaningful on a phone.
      testIgnore: /responsive\.spec\.js/,
    },
    {
      // The narrow layout is a different component tree (AppHeaderNarrow), not
      // just a reflow, so it earns its own project rather than a resize inside
      // one test.
      //
      // browserName is pinned to chromium: the iPhone descriptor would
      // otherwise pull in WebKit, doubling what CI has to download for a
      // viewport-and-touch difference the layout code does not distinguish.
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
      testMatch: /responsive\.spec\.js/,
    },
  ],

  webServer: {
    command: "npm run dev -- --port " + PORT + " --strictPort",
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_APP_ENV: "demo" },
  },
});
