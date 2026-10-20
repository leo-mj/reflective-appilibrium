// @vitest-environment jsdom
//
// The start page wakes a backend that has scaled to zero in two steps: the
// health check, which starts the server, then the warm-up, which starts its
// workers. The editor's notice reads the phase this records.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../config.js", async (importOriginal) => ({
  ...(await importOriginal()),
  BACKEND_ENABLED: true,
  BACKEND_URL: "https://backend.test",
}));

const { wakeBackend, useBackendWake, resetBackendWake } =
  await import("./wakeBackend.js");
const { resetBackendCapabilities, HEALTH_RETRY_EVERY_MS } =
  await import("../hooks/useBackendCapabilities.js");

/** A fetch whose answers the test releases, keyed by the path asked for. */
function controlledFetch() {
  const pending = {};
  const fetchMock = vi.fn((url) => {
    const path = new URL(url).pathname;
    return new Promise((resolve, reject) => {
      pending[path] = { resolve, reject };
    });
  });
  const answer = (path, body, ok = true) =>
    act(async () => {
      pending[path].resolve({ ok, json: async () => body });
      await new Promise((r) => setTimeout(r, 0));
    });
  return { fetchMock, answer, pending };
}

let net;

beforeEach(() => {
  resetBackendCapabilities();
  resetBackendWake();
  net = controlledFetch();
  vi.stubGlobal("fetch", net.fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const phase = (result) => result.current.phase;

describe("wakeBackend", () => {
  it("asks for health first, and for the warm-up only once that answered", async () => {
    const { result } = renderHook(() => useBackendWake());
    expect(phase(result)).toBe("idle");

    act(() => {
      wakeBackend();
    });
    expect(phase(result)).toBe("starting");
    expect(net.fetchMock).toHaveBeenCalledTimes(1);
    expect(net.fetchMock.mock.calls[0][0]).toBe(
      "https://backend.test/api/health",
    );

    await net.answer("/api/health", { status: "ok" });
    expect(phase(result)).toBe("warming");
    expect(net.fetchMock).toHaveBeenCalledTimes(2);
    expect(net.fetchMock.mock.calls[1][0]).toBe(
      "https://backend.test/api/simulate_rethon/warm",
    );
    expect(net.fetchMock.mock.calls[1][1].method).toBe("POST");

    await net.answer("/api/simulate_rethon/warm", { ready: true, seconds: 3 });
    expect(phase(result)).toBe("ready");
  });

  it("remembers when the wait began, for the notice's clock", () => {
    const { result } = renderHook(() => useBackendWake());
    const before = Date.now();
    act(() => {
      wakeBackend();
    });
    expect(result.current.since).toBeGreaterThanOrEqual(before);
  });

  // A server still starting may not answer the first request at all — Cloud
  // Run answered one with a 500 that, lacking a CORS header, reaches the page as
  // a network failure. The check is asked again, and the wait goes on.
  it("keeps starting while the server cannot answer yet, and warms it once it does", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useBackendWake());
      act(() => {
        wakeBackend();
      });
      await act(async () => {
        net.pending["/api/health"].reject(new TypeError("Failed to fetch"));
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(phase(result)).toBe("starting");

      await act(() => vi.advanceTimersByTimeAsync(HEALTH_RETRY_EVERY_MS));
      expect(net.fetchMock).toHaveBeenCalledTimes(2);
      await act(async () => {
        net.pending["/api/health"].resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: "ok" }),
        });
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(phase(result)).toBe("warming");
      expect(net.fetchMock.mock.calls[2][0]).toBe(
        "https://backend.test/api/simulate_rethon/warm",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not warm a backend that refused the health check", async () => {
    const { result } = renderHook(() => useBackendWake());
    act(() => {
      wakeBackend();
    });
    await act(async () => {
      net.pending["/api/health"].resolve({ ok: false, status: 404 });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(phase(result)).toBe("unavailable");
    expect(net.fetchMock).toHaveBeenCalledTimes(1);
  });

  // An older backend has no /warm; its workers start on the first computation.
  it("ends ready even when the warm-up is refused", async () => {
    const { result } = renderHook(() => useBackendWake());
    act(() => {
      wakeBackend();
    });
    await net.answer("/api/health", { status: "ok" });
    await net.answer(
      "/api/simulate_rethon/warm",
      { detail: "Not Found" },
      false,
    );
    expect(phase(result)).toBe("ready");
  });

  it("wakes once per page load, however often the start page appears", async () => {
    act(() => {
      wakeBackend();
      wakeBackend();
    });
    await net.answer("/api/health", { status: "ok" });
    await net.answer("/api/simulate_rethon/warm", { ready: true });
    act(() => {
      wakeBackend();
    });
    expect(net.fetchMock).toHaveBeenCalledTimes(2);
  });
});
