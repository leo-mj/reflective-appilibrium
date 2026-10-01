// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  unwrapDetail,
  backendError,
  fetchBackend,
  fetchOk,
} from "./backendError.js";

afterEach(() => vi.unstubAllGlobals());

/** A minimal Response stand-in; `headers` only needs `get`. */
function res(status, body = "", headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    headers: { get: (k) => headers[k] ?? null },
  };
}

describe("unwrapDetail", () => {
  it("pulls the string out of FastAPI's envelope", () => {
    expect(unwrapDetail('{"detail":"Unsupported provider URL"}')).toBe(
      "Unsupported provider URL",
    );
  });

  // A 422 from request validation is an array of per-field objects. `msg` alone
  // is "Field required" with no hint which field, so the location earns its keep.
  it("names the field for a validation failure", () => {
    const raw = JSON.stringify({
      detail: [{ loc: ["body", "round"], msg: "Field required", type: "missing" }],
    });
    expect(unwrapDetail(raw)).toBe("round: Field required");
  });

  it("joins several validation failures", () => {
    const raw = JSON.stringify({
      detail: [
        { loc: ["body", "round"], msg: "Field required" },
        { loc: ["body", "elements", 0, "id"], msg: "String should match pattern" },
      ],
    });
    expect(unwrapDetail(raw)).toMatch(/round: Field required; elements\.0\.id:/);
  });

  it("returns a plain-text body as-is", () => {
    expect(unwrapDetail("Something went wrong")).toBe("Something went wrong");
  });

  // A reverse proxy answers with a whole HTML page. Pasting that into a banner
  // is worse than saying nothing and letting the status wording stand.
  it("discards an HTML error page", () => {
    expect(unwrapDetail("<html>502 Bad Gateway</html>")).toBe("");
  });

  it("is empty for an empty body", () => {
    expect(unwrapDetail("")).toBe("");
  });
});

describe("backendError", () => {
  // The header has been set by the server since rate limiting existed and was
  // read by nobody. It is the only actionable thing a 429 carries.
  it("tells the reader how long to wait on a 429", async () => {
    const err = await backendError(
      res(429, '{"detail":"Rate limit exceeded (5 requests per minute)."}', {
        "Retry-After": "37",
      }),
    );
    expect(err.message).toMatch(/37 seconds/);
    expect(err.retryAfter).toBe(37);
  });

  it("says the singular for one second", async () => {
    const err = await backendError(res(429, "", { "Retry-After": "1" }));
    expect(err.message).toMatch(/1 second\./);
  });

  it("still says something useful for a 429 with no header", async () => {
    const err = await backendError(res(429, ""));
    expect(err.message).toMatch(/Too many requests/);
    expect(err.retryAfter).toBeNull();
  });

  // Two different statuses, one meaning: this deployment will not spend a key
  // for you, and you have not supplied one.
  it("reads a 403 as a missing key", async () => {
    const err = await backendError(res(403, '{"detail":"Server keys not allowed"}'));
    expect(err.message).toMatch(/No API key configured/);
  });

  it("reads a 400 about x-base-url as a missing key", async () => {
    const err = await backendError(res(400, '{"detail":"Missing x-base-url header"}'));
    expect(err.message).toMatch(/No API key configured/);
  });

  it("does not read every 400 as a missing key", async () => {
    const err = await backendError(res(400, '{"detail":"Unsupported provider URL"}'));
    expect(err.message).toMatch(/Unsupported provider URL/);
    expect(err.message).not.toMatch(/No API key/);
  });

  it("passes a 5xx detail through", async () => {
    const err = await backendError(res(503, '{"detail":"upstream timed out"}'));
    expect(err.message).toMatch(/upstream timed out/);
  });

  it("says something even when the body is empty", async () => {
    const err = await backendError(res(500, ""));
    expect(err.message).toMatch(/backend failed/i);
  });

  it("keeps the status, endpoint and raw detail as properties", async () => {
    const err = await backendError(
      res(422, '{"detail":"too many elements"}'),
      "/api/simulate_rethon/simulate",
    );
    expect(err.status).toBe(422);
    expect(err.endpoint).toBe("/api/simulate_rethon/simulate");
    expect(err.detail).toBe("too many elements");
  });

  // The endpoint is for whoever is debugging, not for the banner.
  it("keeps the endpoint out of the message", async () => {
    const err = await backendError(res(500, ""), "/api/judgments/elicit");
    expect(err.message).not.toMatch(/api\/judgments/);
  });
});

describe("fetchBackend", () => {
  // On a public site the likeliest failure is no response at all — a backend
  // asleep on a free tier, or a CORS origin that does not match. Both arrive as
  // a bare `TypeError: Failed to fetch`, which sends the reader looking at their
  // own state.
  it("explains a transport failure instead of rethrowing TypeError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(fetchBackend("http://x/api/health")).rejects.toThrow(
      /Could not reach the backend/,
    );
  });

  it("keeps the original failure as the cause", async () => {
    const cause = new TypeError("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause));
    await expect(fetchBackend("http://x")).rejects.toMatchObject({ cause });
  });

  // `fetch(url, undefined)` and `fetch(url)` are the same to a browser and
  // different to a mock; a GET should look like a GET to anything watching.
  it("does not pass an undefined init through", async () => {
    const f = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal("fetch", f);
    await fetchBackend("http://x");
    expect(f.mock.calls[0]).toHaveLength(1);
  });
});

describe("fetchOk", () => {
  it("returns the response when it is ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(200, "{}")));
    await expect(fetchOk("http://x")).resolves.toMatchObject({ ok: true });
  });

  it("throws the formatted error when it is not", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(res(429, "", { "Retry-After": "12" })),
    );
    await expect(fetchOk("http://x")).rejects.toThrow(/12 seconds/);
  });
});
