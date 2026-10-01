import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end config.
 *
 * The suite drives the real SPA in a browser, so it needs a dev server. Rather
 * than expecting one to be up, `webServer` starts vite itself and waits for the
 * port — its own port, not vite's default 5173, and never a server already
 * there. It used to reuse one outside CI, so that a manual `npm run dev` was
 * not killed; but that server carries the developer's own .env, and the pinned
 * demo below applied only to a server the suite started. A reused backend build
 * ran the whole suite against a real backend, and the assist audit failed on
 * score badges the demo never draws.
 *
 * VITE_APP_ENV is pinned to "demo" so the run is deterministic: demo turns off
 * the backend, the LLM, and BYOK, which is also what a fresh CI checkout gets
 * (app/.env is gitignored, and an unset VITE_APP_ENV disables the same three
 * flags). Without pinning it, a developer whose .env says "backend" would see
 * the Saved-sessions card appear and the assist tabs hit a real API.
 *
 * The exception is the `backend` project, which needs what demo turns off: the
 * Discuss panel exists only in a build with a backend and a saved key. It gets a
 * second dev server built as "backend", pointed at a backend origin that does
 * not exist — every call to it is answered by `page.route` in the spec, so a
 * real server on localhost:8000 is never reached, and neither is any provider.
 *
 * And the `live-backend` project, the one place the SPA meets the FastAPI server
 * for real: everything else fakes one side of that line — Vitest the network,
 * the `backend` project the server, pytest the browser — so a request or a
 * response changed on one side would pass every test. It starts the server
 * itself (uvicorn, from the repo root) and a dev server built as "backend"
 * pointed at it, and exercises only what needs no key and calls no third
 * party: the rethon scoring and simulation routes. Every setting that decides
 * the server's behaviour is pinned here, so a developer's backend/.env — keys,
 * tokens, a hosted posture — cannot change what it tests.
 */
// Not 5173, which is where a developer's own `npm run dev` lives.
const PORT = 5175;
const BACKEND_BUILD_PORT = 5174;
const LIVE_APP_PORT = 5176;
const LIVE_API_PORT = 8766;
export const FAKE_BACKEND = "http://backend.e2e.invalid";

/** Specs that need the backend build rather than the demo. */
const BACKEND_SPECS = /discuss\.spec\.js/;
/** Specs that need the real server behind that build. */
const LIVE_SPECS = /live-backend\.spec\.js/;

/**
 * The projects named with `--project`, or `null` when none are — a full run.
 *
 * Read so that a run starts only the servers its projects use: every server
 * starts for every run otherwise, and since the live-backend project's include
 * a Python server, one desktop spec was paying for it. Only `--project` is
 * read. A run narrowed any other way — a spec file, `-g`, `--ui` — starts them
 * all, as before; and so does a project given by wildcard, rather than guess.
 *
 * @param {string[]} argv
 * @returns {string[]|null}
 */
function projectsNamed(argv) {
  const names = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--project=")) names.push(argv[i].slice(10));
    else if (argv[i] === "--project" && argv[i + 1]) names.push(argv[++i]);
  }
  return names.length && !names.some((n) => /[*?]/.test(n)) ? names : null;
}
const named = projectsNamed(process.argv);
/** Whether any of these projects is in this run. */
const running = (...projects) =>
  !named || projects.some((p) => named.includes(p));

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
    // The app opens in the system's theme when the reader has not chosen one,
    // and Playwright's browsers report light unless told otherwise. Pinned to
    // dark, which is what the suite — the audits among it — was written
    // against; the tests of the preference itself set their own.
    colorScheme: "dark",
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
      testIgnore: [/responsive\.spec\.js/, BACKEND_SPECS, LIVE_SPECS],
    },
    {
      name: "backend",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        baseURL: `http://localhost:${BACKEND_BUILD_PORT}/`,
      },
      testMatch: BACKEND_SPECS,
    },
    {
      name: "live-backend",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        baseURL: `http://localhost:${LIVE_APP_PORT}/`,
      },
      testMatch: LIVE_SPECS,
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
      // statement-cards.spec.js too, for what a finger does to a card: there
      // is no hover on a phone, and the card view grows a card on hover. And
      // tour.spec.js, since the phone's tour reaches its controls through the
      // ☰ menu rather than the tab bar.
      testMatch: /(responsive|statement-cards|tour)\.spec\.js/,
    },
  ],

  // Each server only for the runs whose projects use it: see `projectsNamed`.
  webServer: [
    running("chromium", "mobile") && {
      command: "npm run dev -- --port " + PORT + " --strictPort",
      url: `http://localhost:${PORT}/`,
      // Never reused, as the backend build's is not: see the header comment.
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_APP_ENV: "demo" },
    },
    running("backend") && {
      // Not reused locally the way the demo server is: a dev server you already
      // have on this port would carry your own .env, and with it a real backend.
      command: "npm run dev -- --port " + BACKEND_BUILD_PORT + " --strictPort",
      url: `http://localhost:${BACKEND_BUILD_PORT}/`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_APP_ENV: "backend", VITE_BACKEND_URL: FAKE_BACKEND },
    },
    running("live-backend") && {
      // The real FastAPI server, for the live-backend project. `python3`, as
      // the README's setup has it; CI's e2e job installs backend/requirements.
      command: `python3 -m uvicorn backend.main:app --port ${LIVE_API_PORT}`,
      cwd: "..",
      url: `http://localhost:${LIVE_API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DEPLOYMENT: "local",
        CORS_ORIGINS: `http://localhost:${LIVE_APP_PORT}`,
        APP_ACCESS_TOKENS: "",
        LLM_API_KEYS: "{}",
        CROSSREF_ENABLED: "false",
      },
    },
    running("live-backend") && {
      command: "npm run dev -- --port " + LIVE_APP_PORT + " --strictPort",
      url: `http://localhost:${LIVE_APP_PORT}/`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_APP_ENV: "backend",
        VITE_BACKEND_URL: `http://localhost:${LIVE_API_PORT}`,
      },
    },
  ].filter(Boolean),
});
