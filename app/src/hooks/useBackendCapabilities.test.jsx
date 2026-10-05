// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";

// BACKEND_ENABLED is a build-time constant, so the demo case has to be
// simulated by mocking the config module rather than by setting an env var.
vi.mock("../config.js", () => ({
  BACKEND_ENABLED: true,
  BACKEND_URL: "http://localhost:8000",
}));

const {
  useBackendCapabilities,
  prefetchBackendCapabilities,
  resetBackendCapabilities,
  HEALTH_RETRY_FOR_MS,
  HEALTH_RETRY_EVERY_MS,
} = await import("./useBackendCapabilities.js");

beforeEach(() => {
  // The health check is cached for the life of the page now — one per load,
  // shared by every caller — so each test has to start from a clean module.
  resetBackendCapabilities();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const respondWith = (body, ok = true, status = ok ? 200 : 404) =>
  fetch.mockResolvedValue({ ok, status, json: async () => body });

const answer = (body, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

describe("useBackendCapabilities", () => {
  it("starts unloaded and offering nothing", () => {
    respondWith({ status: "ok", max_simulation_elements: 20 });
    const { result } = renderHook(() => useBackendCapabilities());
    expect(result.current.loaded).toBe(false);
    expect(result.current.reachable).toBe(false);
    expect(result.current.maxElements).toBe(0);
  });

  it("reports a backend that answered as reachable", async () => {
    respondWith({ status: "ok", deployment: "local" });
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.reachable).toBe(true);
  });

  it("treats a backend that is down as offering nothing, once the retries run out", async () => {
    vi.useFakeTimers();
    fetch.mockRejectedValue(new Error("connection refused"));
    const { result } = renderHook(() => useBackendCapabilities());
    await vi.advanceTimersByTimeAsync(HEALTH_RETRY_FOR_MS - 10_000);
    expect(result.current.loaded).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(result.current.loaded).toBe(true);
    expect(result.current.reachable).toBe(false);
    expect(result.current.maxElements).toBe(0);
    const asked = fetch.mock.calls.length;
    // One at once, then one every interval to the end of the window.
    expect(asked).toBe(Math.floor(HEALTH_RETRY_FOR_MS / HEALTH_RETRY_EVERY_MS) + 1);
    await vi.advanceTimersByTimeAsync(HEALTH_RETRY_FOR_MS);
    expect(fetch).toHaveBeenCalledTimes(asked);
  });

  // What Cloud Run did to the first request while an instance was starting: a
  // 500 of the platform's own, which the browser sees as a network failure
  // because it carries no CORS header. Settled on it, the page kept "no depth
  // cap known" until reloaded.
  it("asks again while a starting server cannot answer", async () => {
    vi.useFakeTimers();
    fetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(answer({}, 500))
      .mockResolvedValueOnce(answer({}, 429))
      .mockResolvedValue(answer({ status: "ok", max_neighbourhood_depth: 2 }));
    const { result } = renderHook(() => useBackendCapabilities());
    await vi.advanceTimersByTimeAsync(2 * HEALTH_RETRY_EVERY_MS);
    expect(result.current.loaded).toBe(false);
    await vi.advanceTimersByTimeAsync(HEALTH_RETRY_EVERY_MS);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(result.current.loaded).toBe(true);
    expect(result.current.reachable).toBe(true);
    expect(result.current.maxDepth).toBe(2);
  });

  it("treats a non-OK response that is not about starting as unreachable, at once", async () => {
    respondWith({}, false, 404);
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.reachable).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("asks the health endpoint exactly once", async () => {
    respondWith({ status: "ok" });
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/health$/);
  });

  // Replaces an abort-on-unmount test. Aborting was right while each mount
  // owned its own request; now that one shared check serves every caller, a
  // component unmounting must not cancel the answer the others are waiting for.
  it("serves many callers from a single request", async () => {
    respondWith({ status: "ok", max_simulation_elements: 20 });
    const a = renderHook(() => useBackendCapabilities());
    const b = renderHook(() => useBackendCapabilities());
    const c = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(a.result.current.loaded).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(b.result.current.reachable).toBe(true);
    expect(c.result.current.maxElements).toBe(20);
  });

  it("does not re-ask after one caller unmounts", async () => {
    respondWith({ status: "ok" });
    const first = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    first.unmount();

    const second = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(second.result.current.loaded).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // The cap the score-delta badges need: they score the state plus one element,
  // so at exactly this number every badge would ask for one too many.
  it("reports the element cap", async () => {
    respondWith({ status: "ok", max_simulation_elements: 20 });
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.maxElements).toBe(20);
  });

  // Which providers the LLM settings offer: hosted, the server refuses Ollama.
  it("reports the deployment, and null when the backend does not say", async () => {
    respondWith({ status: "ok", deployment: "hosted" });
    const { result } = renderHook(() => useBackendCapabilities());
    expect(result.current.deployment).toBeNull();
    await waitFor(() => expect(result.current.deployment).toBe("hosted"));

    resetBackendCapabilities();
    respondWith({ status: "ok" });
    const older = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(older.result.current.loaded).toBe(true));
    expect(older.result.current.deployment).toBeNull();
  });

  it("treats a missing cap as no cap", async () => {
    respondWith({ status: "ok" });
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.maxElements).toBe(0);
  });
});

// The start page calls this so that a backend scaled to zero starts while the
// reader is still on it. It must be the editor's own request, started early —
// not a second one.
describe("prefetchBackendCapabilities", () => {
  it("starts the health check with no component subscribed", () => {
    respondWith({ status: "ok" });
    prefetchBackendCapabilities();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/health$/);
  });

  it("is the request later callers join, not an extra one", async () => {
    respondWith({ status: "ok", max_simulation_elements: 20 });
    prefetchBackendCapabilities();
    prefetchBackendCapabilities();
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.maxElements).toBe(20);
  });

  it("hands its answer to a caller that arrives after it settled", async () => {
    respondWith({ status: "ok", deployment: "hosted" });
    prefetchBackendCapabilities();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    const { result } = renderHook(() => useBackendCapabilities());
    expect(result.current.loaded).toBe(true);
    expect(result.current.deployment).toBe("hosted");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
