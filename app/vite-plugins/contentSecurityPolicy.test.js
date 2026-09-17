// The site's Content-Security-Policy, written into built pages only.
//
// Two ways this goes wrong without anyone noticing until a visitor does: the
// inline theme script stops matching its hash (the page loads in the wrong
// theme, and the console says why), or the backend's origin is missing from
// connect-src (every API call is refused). Both are pinned here against the
// real index.html, since a hash of a copy would prove nothing.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";

import {
  backendOrigin,
  buildPolicy,
  contentSecurityPolicy,
  inlineScriptHashes,
} from "./contentSecurityPolicy.js";

const INDEX_HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");

/** What the plugin writes into index.html for a build with this env. */
function built(env) {
  const plugin = contentSecurityPolicy();
  plugin.configResolved({ env });
  return plugin.transformIndexHtml.handler(INDEX_HTML);
}

const policyOf = (html) =>
  html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];

const directive = (policy, name) =>
  policy
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.split(" ")
    .slice(1);

describe("the inline script", () => {
  it("is allowed by the hash of its exact text in index.html", () => {
    const script = INDEX_HTML.match(/<script>([\s\S]*?)<\/script>/)[1];
    const expected = createHash("sha256").update(script, "utf8").digest("base64");

    const scriptSrc = directive(policyOf(built({ VITE_APP_ENV: "demo" })), "script-src");

    expect(scriptSrc).toEqual(["'self'", `'sha256-${expected}'`]);
  });

  it("is the only thing hashed: module scripts load from 'self'", () => {
    const html = '<script type="module" src="/a.js"></script><script>x()</script>';
    expect(inlineScriptHashes(html)).toHaveLength(1);
  });

  it("is never allowed wholesale", () => {
    const policy = policyOf(built({ VITE_APP_ENV: "backend", VITE_BACKEND_URL: "https://api.example.org" }));
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).not.toContain("unsafe-eval");
  });
});

describe("connect-src", () => {
  it("names the backend's origin, and nothing else beyond 'self'", () => {
    const html = built({
      VITE_APP_ENV: "backend",
      VITE_BACKEND_URL: "https://api.example.org/some/path",
    });
    expect(directive(policyOf(html), "connect-src")).toEqual([
      "'self'",
      "https://api.example.org",
    ]);
  });

  it("falls back to the same default the clients use", () => {
    expect(backendOrigin({ VITE_APP_ENV: "dev" })).toBe("http://localhost:8000");
  });

  it("allows no backend at all in the demo build, which has none", () => {
    expect(directive(policyOf(built({ VITE_APP_ENV: "demo" })), "connect-src")).toEqual([
      "'self'",
    ]);
  });

  it("refuses to build against the .env.backend placeholder", () => {
    expect(() =>
      built({ VITE_APP_ENV: "backend", VITE_BACKEND_URL: "https://<deployed-backend-url>" }),
    ).toThrow(/VITE_BACKEND_URL is not a URL/);
  });
});

describe("the tag", () => {
  it("comes before every script and stylesheet, which it would not govern otherwise", () => {
    const html = built({ VITE_APP_ENV: "demo" });
    const tag = html.indexOf('http-equiv="Content-Security-Policy"');
    expect(tag).toBeGreaterThan(-1);
    expect(tag).toBeLessThan(html.indexOf("<script"));
    expect(tag).toBeLessThan(html.indexOf("<link"));
  });

  it("is added to builds only, never to the dev server", () => {
    expect(contentSecurityPolicy().apply).toBe("build");
  });
});

it("shuts plugins and base-URL rewriting out", () => {
  const policy = buildPolicy({ scriptHashes: [], backend: null });
  expect(directive(policy, "object-src")).toEqual(["'none'"]);
  expect(directive(policy, "base-uri")).toEqual(["'self'"]);
});
