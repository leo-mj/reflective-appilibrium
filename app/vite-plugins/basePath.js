/**
 * @fileoverview The path a build is served from — Vite's `base`.
 *
 * Every asset URL in the built page is prefixed with it, so a build served from
 * a path it was not built for 404s every asset and renders a blank page.
 *
 * `VITE_BASE_PATH` says it outright, and wins: a site served from its root
 * (a university host, pages.dev) sets `/`. Without it the path is derived as it
 * always was — GitHub Pages serves a project site from `/<repo>/`, and Actions
 * sets GITHUB_REPOSITORY to "owner/repo" — which is right only on GitHub, since
 * no other CI sets that variable. The literal repo name is the fallback for a
 * Pages-bound build run outside CI.
 *
 * @module vite-plugins/basePath
 */

// Listed by destination rather than tested as `mode === "production"`. Only the
// demo goes to GitHub Pages. `build:backend` used to as well, which is why this
// list once named `backend` too; that build now goes to a host serving from its
// root (Cloudflare, the nginx image), so it takes "/" like the dev server
// and `build:local`. A backend build bound for a sub-path sets VITE_BASE_PATH.
const PAGES_MODES = ["production"];

const DEFAULT_REPO = "reflective-appilibrium";

/**
 * @param {Object} args
 * @param {string} args.mode                 Vite's mode.
 * @param {string} [args.explicit]           VITE_BASE_PATH, if set.
 * @param {string} [args.githubRepository]   GITHUB_REPOSITORY, if set.
 * @returns {string}  Always starting and ending with a slash.
 */
export function basePath({ mode, explicit, githubRepository }) {
  const given = explicit?.trim();
  if (given) return `/${given.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
  if (!PAGES_MODES.includes(mode)) return "/";
  const repo = githubRepository?.split("/")[1];
  return `/${repo ?? DEFAULT_REPO}/`;
}
