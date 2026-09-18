/**
 * @fileoverview What VITE_BACKEND_URL means, in one place.
 *
 * Read by the app (`config.js`, which every client imports `BACKEND_URL` from)
 * and by the build (`vite-plugins/contentSecurityPolicy.js`, which has to allow
 * the same address the clients call). It used to be spelled out in each of six
 * clients and again in the plugin, kept in step by hand — and none of them
 * could say "the backend is on this site", since an empty value fell back to
 * localhost. Plain JavaScript with no `import.meta`, so Node can load it too.
 *
 * Three forms:
 *
 * - **unset or empty** — `http://localhost:8000`, the dev backend.
 * - **an absolute URL** — a backend on its own host, e.g. `https://api.example.org`.
 * - **a path** — the backend behind the same host as the page, reached through
 *   the proxy that serves both: `/` for `/api/…` at the root, `/prefix` for
 *   `/prefix/api/…`. Same origin, so no CORS and nothing extra in the policy.
 *
 * A path is spelled with its slash rather than left empty on purpose: an empty
 * value is also what an unset CI variable produces, and a build should not
 * quietly change where it sends requests because a variable went missing.
 *
 * @module backendUrl
 */

export const DEFAULT_BACKEND_URL = "http://localhost:8000";

/**
 * The prefix every API path is appended to: `${prefix}/api/health`. Never ends
 * in a slash, so a path form of `/` resolves to `""` and the request is `/api/…`.
 *
 * @param {string|undefined} raw  VITE_BACKEND_URL as set.
 * @returns {string}
 */
export function resolveBackendUrl(raw) {
  const value = (raw ?? "").trim();
  if (!value) return DEFAULT_BACKEND_URL;
  return value.replace(/\/+$/, "");
}

/**
 * Whether a resolved prefix points at the page's own origin. `//host` is a
 * protocol-relative URL — another host — not a path.
 *
 * @param {string} prefix  A value returned by {@link resolveBackendUrl}.
 * @returns {boolean}
 */
export function isSameOrigin(prefix) {
  return prefix === "" || (prefix.startsWith("/") && !prefix.startsWith("//"));
}
