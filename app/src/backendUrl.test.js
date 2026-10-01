// What VITE_BACKEND_URL means. The clients build `${prefix}/api/…` from this and
// the CSP plugin allows the origin it names, so a wrong answer here is either
// every request going to the wrong place or every request being refused.
import { describe, it, expect } from "vitest";
import { DEFAULT_BACKEND_URL, isSameOrigin, resolveBackendUrl } from "./backendUrl.js";

const request = (raw, path = "/api/health") => `${resolveBackendUrl(raw)}${path}`;

describe("resolveBackendUrl", () => {
  it.each([undefined, "", "   "])("falls back to the dev backend for %j", (raw) => {
    expect(resolveBackendUrl(raw)).toBe(DEFAULT_BACKEND_URL);
  });

  it("keeps an absolute URL, without a trailing slash", () => {
    expect(request("https://api.example.org/")).toBe("https://api.example.org/api/health");
    expect(request("https://api.example.org")).toBe("https://api.example.org/api/health");
  });

  // The university case: the proxy serves the page and routes /api to the
  // backend, so requests carry no origin at all.
  it("turns / into a request on the page's own origin", () => {
    expect(resolveBackendUrl("/")).toBe("");
    expect(request("/")).toBe("/api/health");
  });

  it("keeps a path prefix for a backend mounted under one", () => {
    expect(request("/tools/re/")).toBe("/tools/re/api/health");
  });

  // Never `//api/health`: that is a protocol-relative URL for a host called "api".
  it("never produces a double slash before /api", () => {
    for (const raw of ["/", "//", "/x//", "https://a.org//"]) {
      expect(request(raw)).not.toMatch(/^\/\/|[^:]\/\/api/);
    }
  });
});

describe("isSameOrigin", () => {
  it.each([
    ["/", true],
    ["/prefix", true],
    ["https://api.example.org", false],
    ["http://localhost:8000", false],
    ["//api.example.org", false],
  ])("%j → %s", (raw, expected) => {
    expect(isSameOrigin(resolveBackendUrl(raw))).toBe(expected);
  });

  it("does not treat an unset value as same-origin — that is the dev backend", () => {
    expect(isSameOrigin(resolveBackendUrl(""))).toBe(false);
  });
});
