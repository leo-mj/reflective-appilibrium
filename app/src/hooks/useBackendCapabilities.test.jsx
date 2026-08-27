// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";

// BACKEND_ENABLED is a build-time constant, so the demo case has to be
// simulated by mocking the config module rather than by setting an env var.
vi.mock("../config.js", () => ({ BACKEND_ENABLED: true }));

const { useBackendCapabilities } = await import("./useBackendCapabilities.js");

beforeEach(() => {
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

  it("aborts the request if it unmounts first", () => {
    respondWith({ status: "ok", sessions: true });
    const { unmount } = renderHook(() => useBackendCapabilities());
    const { signal } = fetch.mock.calls[0][1];
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
