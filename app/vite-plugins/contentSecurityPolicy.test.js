// The site's Content-Security-Policy, written into built pages only.
//
// Two ways this goes wrong without anyone noticing until a visitor does: the
// inline theme script stops matching its hash (the page loads in the wrong
// theme, and the console says why), or the backend's origin is missing from
// connect-src (every API call is refused). Both are pinned here against the
// real index.html, since a hash of a copy would prove nothing.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";

import {
  backendOrigin,
  buildPolicy,
  contentSecurityPolicy,
  headersFile,
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

  // Behind one proxy, as at a university host: /api on the page's own origin,
  // which 'self' already allows. Naming it again would be harmless; naming the
  // localhost default, which is what an empty value used to mean, would not.
  it.each(["/", "/prefix", "/prefix/"])(
    "adds nothing beyond 'self' for a backend at %j on the same host",
    (url) => {
      const html = built({ VITE_APP_ENV: "backend", VITE_BACKEND_URL: url });
      expect(directive(policyOf(html), "connect-src")).toEqual(["'self'"]);
    },
  );

  it("does not take a protocol-relative address for the same host", () => {
    expect(() => built({ VITE_APP_ENV: "backend", VITE_BACKEND_URL: "//api.example.org" })).toThrow(
      /VITE_BACKEND_URL is not a URL/,
    );
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

describe("_headers", () => {
  /** Run a whole build through the plugin and return the _headers it wrote. */
  function writtenHeaders(env) {
    const dir = mkdtempSync(join(tmpdir(), "csp-"));
    try {
      const plugin = contentSecurityPolicy();
      plugin.configResolved({ env });
      const html = plugin.transformIndexHtml.handler(INDEX_HTML);
      plugin.writeBundle({ dir });
      return { html, headers: readFileSync(join(dir, "_headers"), "utf8") };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  const headerPolicy = (headers) =>
    headers.match(/^ {2}Content-Security-Policy: (.*)$/m)[1];

  it("carries the page's own policy, plus frame-ancestors", () => {
    // The point of generating both from one list: the header is the meta tag's
    // policy and one directive more, never a second policy to keep in step.
    const { html, headers } = writtenHeaders({
      VITE_APP_ENV: "backend",
      VITE_BACKEND_URL: "https://api.example.org",
    });
    expect(headerPolicy(headers)).toBe(`${policyOf(html)}; frame-ancestors 'none'`);
  });

  it("applies to every path, with the headers the backend sends", () => {
    const { headers } = writtenHeaders({ VITE_APP_ENV: "demo" });
    expect(headers.split("\n")[0]).toBe("/*");
    expect(headers).toContain("  X-Content-Type-Options: nosniff\n");
    expect(headers).toContain("  Referrer-Policy: no-referrer\n");
  });

  it("keeps frame-ancestors out of the meta tag, where browsers ignore it", () => {
    expect(policyOf(built({ VITE_APP_ENV: "demo" }))).not.toContain("frame-ancestors");
  });

  it("refuses to write a file when no page was built to take a policy from", () => {
    const plugin = contentSecurityPolicy();
    plugin.configResolved({ env: { VITE_APP_ENV: "demo" } });
    expect(() => plugin.writeBundle({ dir: tmpdir() })).toThrow(/index.html was not built/);
  });

  it("is one header per line, indented under its path", () => {
    const lines = headersFile("default-src 'self'").trimEnd().split("\n");
    expect(lines.slice(1).every((l) => /^ {2}[A-Za-z-]+: \S/.test(l))).toBe(true);
  });
});

it("shuts plugins and base-URL rewriting out", () => {
  const policy = buildPolicy({ scriptHashes: [], backend: null });
  expect(directive(policy, "object-src")).toEqual(["'none'"]);
  expect(directive(policy, "base-uri")).toEqual(["'self'"]);
});
