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
