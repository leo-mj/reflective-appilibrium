import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves a project site from /<repo>/, so the production build's
// asset URLs must be prefixed with the repo name — a mismatch 404s every asset
// and renders a blank page. Actions sets GITHUB_REPOSITORY to "owner/repo", so
// deriving it there keeps this correct across repo renames; the literal is only
// the fallback for a production build run outside CI.
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? `/${repoName ?? "reflective-appilibrium"}/` : "/",
  plugins: [react()],
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
