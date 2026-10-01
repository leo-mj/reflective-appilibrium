import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { contentSecurityPolicy } from "./vite-plugins/contentSecurityPolicy.js";
import { basePath } from "./vite-plugins/basePath.js";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // VITE_BASE_PATH if set, else derived for GitHub Pages; see vite-plugins/basePath.js.
  // Read through loadEnv so a .env file can set it as well as the environment.
  base: basePath({
    mode,
    explicit: loadEnv(mode, process.cwd(), "VITE_").VITE_BASE_PATH,
    githubRepository: process.env.GITHUB_REPOSITORY,
  }),
  // The CSP is written into built pages only; see vite-plugins/contentSecurityPolicy.js.
  plugins: [react(), contentSecurityPolicy()],
  test: {
    environment: "node",
    // Tests run as the demo build, as they do in CI, where there is no .env
    // (it is gitignored) — and as the Playwright suite pins its own server.
    // A developer's .env saying "backend" otherwise made components rendered
    // whole (REState.test.jsx) fire real scoring requests at a server that is
    // not running; the failures landed at unpredictable times, and one landing
    // after its file had finished broke the run with "Closing rpc while
    // onUserConsoleLog was pending". A test that needs the backend on says so
    // itself.
    env: { VITE_APP_ENV: "demo" },
    // The e2e suite is Playwright's, and it needs a real browser. Vitest's
    // default `include` would otherwise pick up e2e/*.spec.js and fail on the
    // @playwright/test import.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    coverage: {
      provider: "v8",
      include: ["src/utils/**", "src/hooks/**"],
    },
  },
}));
