/**
 * @fileoverview Writes the site's Content-Security-Policy into the built
 * index.html, and into a `_headers` file beside it.
 *
 * GitHub Pages serves no custom response headers, so a `<meta http-equiv>` tag
 * is the only way a site there gets a policy at all. The directive that
 * earns its keep is `connect-src`: the app holds visitors' API keys in
 * sessionStorage, and a script injected into the page — by a compromised
 * dependency, say — could otherwise send one anywhere. With this policy it can
 * reach this site and the backend, and nothing else.
 *
 * Generated at build time rather than written into index.html by hand, for
 * three reasons:
 *
 * - **The backend origin is only known then.** It comes from VITE_BACKEND_URL,
 *   a repository variable in CI; a policy naming it by hand would be wrong on
 *   every other build. A backend behind the page's own host needs no entry.
 * - **The inline script is allowed by its hash**, not by `'unsafe-inline'`
 *   (which would allow exactly the injected script this exists to stop). A
 *   hash typed in by hand goes stale the first time someone edits the script,
 *   and breaks the theme on load with nothing but a console line to say why.
 * - **The dev server must not get it.** Vite's dev client injects inline
 *   scripts and opens a websocket for hot reload; a policy would block both.
 *   So `apply: "build"` — `npm run dev` and the e2e suite, which runs on it,
 *   are untouched.
 *
 * What a meta tag cannot do: `frame-ancestors`, `report-uri` and `sandbox` are
 * ignored when delivered this way, so clickjacking protection is not something
 * GitHub Pages can offer. Cloudflare Pages (and Netlify) can: they read a
 * `_headers` file from the site root and send what it lists as real response
 * headers. So every build also writes one, carrying the **same** policy plus
 * the header-only `frame-ancestors 'none'` — one directive list, two
 * deliveries, so the two cannot drift. A browser given both enforces both,
 * which is harmless when one is the other plus a directive. On GitHub Pages
 * the file is served as an inert static file; there is no build switch to
 * forget.
 *
 * The file's other two headers are the ones the backend already sends on its
 * own responses (backend/security_headers.py), so the page and the API it
 * calls say the same thing.
 *
 * @module vite-plugins/contentSecurityPolicy
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { isSameOrigin, resolveBackendUrl } from "../src/backendUrl.js";

/** The environments that talk to a backend — BACKEND_ENABLED in src/config.js. */
const BACKEND_ENVS = ["dev", "backend"];

// An inline script is a <script> with no src attribute. Content is captured
// exactly, whitespace included, since that is what the browser hashes.
const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * The base64 SHA-256 of every inline script's content, as CSP expects it.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function inlineScriptHashes(html) {
  return [...html.matchAll(INLINE_SCRIPT)]
    .map((match) => match[1])
    .map((content) => createHash("sha256").update(content, "utf8").digest("base64"));
}

/**
 * The backend's origin for this build, or null when `'self'` already covers it:
 * a build with no backend, or one whose backend is behind the same host as the
 * page. Resolved by src/backendUrl.js, as the clients resolve it, so the policy
 * allows exactly the address they call.
 *
 * @param {Record<string, string>} env  Vite's resolved env (VITE_* included).
 * @returns {string|null}
 */
export function backendOrigin(env) {
  if (!BACKEND_ENVS.includes(env.VITE_APP_ENV)) return null;
  const url = resolveBackendUrl(env.VITE_BACKEND_URL);
  if (isSameOrigin(url)) return null;
  try {
    return new URL(url).origin;
  } catch {
    // Most likely the placeholder in .env.backend. A build carrying it cannot
    // reach any backend, and a policy cannot name an origin that does not
    // exist — so stop here, where the reason can be said, rather than ship a
    // site whose every request is refused.
    throw new Error(
      `VITE_BACKEND_URL is not a URL (${JSON.stringify(url)}), so the Content-Security-Policy ` +
        "cannot allow the backend. Set it to the backend's address, e.g. " +
        "VITE_BACKEND_URL=https://api.example.org npm run build:backend, or to / " +
        "when the backend is served from the same host as the page.",
    );
  }
}

/**
 * Directives a browser honours only in a response header. In a meta tag they
 * are ignored with a console warning, so they are left out of it rather than
 * written where they do nothing.
 */
const HEADER_ONLY = [["frame-ancestors", "'none'"]];

/**
 * The policy — as the content of a meta tag by default, or of a response
 * header with `delivery: "header"`, which adds the directives only a header
 * can carry.
 *
 * @param {{ scriptHashes: string[], backend: string|null, delivery?: "meta"|"header" }} args
 * @returns {string}
 */
export function buildPolicy({ scriptHashes, backend, delivery = "meta" }) {
  const directives = [
    ["default-src", "'self'"],
    ["script-src", "'self'", ...scriptHashes.map((h) => `'sha256-${h}'`)],
    // No 'unsafe-inline': React and d3 set styles through the CSSOM, which a
    // policy does not govern, and nothing here writes a style attribute or a
    // <style> element into the page. (generateSVG's <style> goes into exported
    // files, never the DOM.)
    ["style-src", "'self'"],
    ["img-src", "'self'"],
    ["font-src", "'self'"],
    ["connect-src", "'self'", ...(backend ? [backend] : [])],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ...(delivery === "header" ? HEADER_ONLY : []),
  ];
  return directives.map((parts) => parts.join(" ")).join("; ");
}

/**
 * The `_headers` file: every path on the site gets the policy as a header, and
 * the two headers the backend sends too.
 *
 * @param {string} policy  From `buildPolicy({ …, delivery: "header" })`.
 * @returns {string}
 */
export function headersFile(policy) {
  return [
    "/*",
    `  Content-Security-Policy: ${policy}`,
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: no-referrer",
    "",
  ].join("\n");
}

/**
 * The Vite plugin.
 *
 * @returns {import("vite").Plugin}
 */
export function contentSecurityPolicy() {
  let env = {};
  let outDir = "dist";
  // What the page's own tag was built from, kept for `_headers`. The hashes
  // exist only once Vite has finished with index.html, so the file is written
  // at the end of the build rather than emitted alongside the assets.
  let policyInputs = null;
  return {
    name: "content-security-policy",
    apply: "build",
    configResolved(config) {
      env = config.env;
      outDir = config.build?.outDir ?? outDir;
    },
    transformIndexHtml: {
      // After Vite has written its own tags, so the hashes are of the page as
      // shipped.
      order: "post",
      handler(html) {
        policyInputs = {
          scriptHashes: inlineScriptHashes(html),
          backend: backendOrigin(env),
        };
        const policy = buildPolicy(policyInputs);
        const charset = /<meta\s+charset=[^>]*>/i;
        if (!charset.test(html)) {
          throw new Error("index.html has no <meta charset>; the CSP tag is placed after it.");
        }
        // Straight after the charset, ahead of every link and script: a meta
        // policy governs only what the parser meets after it.
        return html.replace(
          charset,
          (tag) => `${tag}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
        );
      },
    },
    writeBundle(options) {
      if (!policyInputs) {
        // A site served without its headers would look exactly like one served
        // with them, until someone framed it.
        throw new Error("index.html was not built, so there is no policy to write to _headers.");
      }
      const policy = buildPolicy({ ...policyInputs, delivery: "header" });
      writeFileSync(join(options.dir ?? outDir, "_headers"), headersFile(policy));
    },
  };
}
