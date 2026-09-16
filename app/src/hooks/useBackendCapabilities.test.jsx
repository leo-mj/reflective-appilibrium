// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";

// BACKEND_ENABLED is a build-time constant, so the demo case has to be
// simulated by mocking the config module rather than by setting an env var.
vi.mock("../config.js", () => ({ BACKEND_ENABLED: true }));

const { useBackendCapabilities, resetBackendCapabilities } = await import(
  "./useBackendCapabilities.js"
);

beforeEach(() => {
  // The health check is cached for the life of the page now — one per load,
  // shared by every caller — so each test has to start from a clean module.
  resetBackendCapabilities();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const respondWith = (body, ok = true) =>
  fetch.mockResolvedValue({ ok, json: async () => body });

describe("useBackendCapabilities", () => {
  it("starts unloaded and offering nothing", () => {
    respondWith({ status: "ok", sessions: true });
    const { result } = renderHook(() => useBackendCapabilities());
    expect(result.current.loaded).toBe(false);
    expect(result.current.sessions).toBe(false);
  });

  it("reports sessions on for a local backend", async () => {
    respondWith({ status: "ok", deployment: "local", sessions: true });
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.reachable).toBe(true);
    expect(result.current.sessions).toBe(true);
  });

  it("reports sessions off for a hosted backend", async () => {
    respondWith({ status: "ok", deployment: "hosted", sessions: false });
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.sessions).toBe(false);
  });

  it("treats a backend that is down as offering nothing", async () => {
    fetch.mockRejectedValue(new Error("connection refused"));
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.reachable).toBe(false);
    expect(result.current.sessions).toBe(false);
  });

  it("treats a non-OK response as unreachable", async () => {
    respondWith({}, false);
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.reachable).toBe(false);
  });

  it("assumes no sessions when the field is missing", async () => {
    // An older backend has no `sessions` field. Assuming "yes" would put the
    // Save button back on a server that may refuse it.
    respondWith({ status: "ok", model: "gpt-4o-mini" });
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.reachable).toBe(true);
    expect(result.current.sessions).toBe(false);
  });

  it("asks the health endpoint exactly once", async () => {
    respondWith({ status: "ok", sessions: true });
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/health$/);
  });

  // Replaces an abort-on-unmount test. Aborting was right while each mount
  // owned its own request; now that one shared check serves every caller, a
  // component unmounting must not cancel the answer the others are waiting for.
  it("serves many callers from a single request", async () => {
    respondWith({ status: "ok", sessions: true, max_simulation_elements: 20 });
    const a = renderHook(() => useBackendCapabilities());
    const b = renderHook(() => useBackendCapabilities());
    const c = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(a.result.current.loaded).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(b.result.current.sessions).toBe(true);
    expect(c.result.current.maxElements).toBe(20);
  });

  it("does not re-ask after one caller unmounts", async () => {
    respondWith({ status: "ok", sessions: true });
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
    respondWith({ status: "ok", sessions: false, max_simulation_elements: 20 });
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.maxElements).toBe(20);
  });

  it("treats a missing cap as no cap", async () => {
    respondWith({ status: "ok", sessions: true });
    const { result } = renderHook(() => useBackendCapabilities());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.maxElements).toBe(0);
  });
});
