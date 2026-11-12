// @vitest-environment jsdom
//
// A backend that has scaled to zero takes a while to answer, and the editor is
// where someone would be left waiting with blank score badges and nothing to
// say why. The notice says what is starting and for how long it has been.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

vi.mock("../../config.js", async (importOriginal) => ({
  ...(await importOriginal()),
  BACKEND_ENABLED: true,
  BACKEND_URL: "https://backend.test",
}));

const { ServerWakeNotice } = await import("./ServerWakeNotice.jsx");
const { wakeBackend, resetBackendWake } =
  await import("../../utils/wakeBackend.js");
const { resetBackendCapabilities } =
  await import("../../hooks/useBackendCapabilities.js");
const { fetchBackend, ServerStartingError, ServerUnreachableError } =
  await import("../../utils/backendError.js");
const { STARTUP_GRACE_MS } = await import("../../utils/wakeBackend.js");

let pending;

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  resetBackendCapabilities();
  resetBackendWake();
  pending = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url) =>
        new Promise((resolve) => {
          pending[new URL(url).pathname] = resolve;
        }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function answer(path, body) {
  await act(async () => {
    pending[path]({ ok: true, json: async () => body });
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

const wait = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const notice = () => screen.queryByRole("status");

describe("ServerWakeNotice", () => {
  it("says nothing for a wait too short to notice", () => {
    act(() => {
      wakeBackend();
    });
    render(<ServerWakeNotice />);
    wait(1000);
    expect(notice()).toBeNull();
  });

  it("says the server is starting, and for how long", () => {
    act(() => {
      wakeBackend();
    });
    render(<ServerWakeNotice />);
    wait(3000);
    expect(notice().textContent).toContain("Starting the server…");
    expect(notice().textContent).toContain("3 s");
    wait(5000);
    expect(notice().textContent).toContain("8 s");
  });

  it("moves on to the workers once the server answers, and goes when they are up", async () => {
    act(() => {
      wakeBackend();
    });
    render(<ServerWakeNotice />);
    wait(4000);
    await answer("/api/health", { status: "ok" });
    wait(1000);
    expect(notice().textContent).toContain("Preparing scores and simulations…");
    // One clock for the whole wait, not restarted between the phases.
    expect(notice().textContent).toContain("5 s");

    await answer("/api/simulate_rethon/warm", { ready: true });
    expect(notice()).toBeNull();
  });

  it("announces the phase but not every tick of the clock", () => {
    act(() => {
      wakeBackend();
    });
    render(<ServerWakeNotice />);
    wait(3000);
    const clock = screen.getByText("3 s");
    expect(clock.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows nothing when the backend was never woken", () => {
    render(<ServerWakeNotice />);
    wait(10000);
    expect(notice()).toBeNull();
  });

  async function failOnce() {
    fetch.mockImplementationOnce(() =>
      Promise.reject(new TypeError("Failed to fetch")),
    );
    let failure;
    await act(async () => {
      failure = await fetchBackend(
        "https://backend.test/api/judgments/elicit",
        { method: "POST" },
      ).catch((e) => e);
    });
    return failure;
  }

  async function wakeFully() {
    act(() => {
      wakeBackend();
    });
    render(<ServerWakeNotice />);
    await answer("/api/health", { status: "ok" });
    await answer("/api/simulate_rethon/warm", { ready: true });
    expect(notice()).toBeNull();
  }

  it("calls a request that reaches no server during the start a wait", async () => {
    act(() => {
      wakeBackend();
    });
    render(<ServerWakeNotice />);
    expect(await failOnce()).toBeInstanceOf(ServerStartingError);
    await answer("/api/health", { status: "ok" });
    expect(await failOnce()).toBeInstanceOf(ServerStartingError);
  });

  it("still calls it a wait just after the start", async () => {
    await wakeFully();
    wait(STARTUP_GRACE_MS - 1000);
    expect(await failOnce()).toBeInstanceOf(ServerStartingError);
  });

  // A hosted backend scales to zero behind a page left open, and from here
  // that looks like any other failure to answer — so it is the serious error,
  // and the notice that follows says whether the server is coming back.
  it("calls it a failure at any other time, and wakes the server again", async () => {
    await wakeFully();
    wait(STARTUP_GRACE_MS + 1000);
    expect(await failOnce()).toBeInstanceOf(ServerUnreachableError);
    expect(fetch).toHaveBeenLastCalledWith("https://backend.test/api/health");

    wait(3000);
    // Not "starting": nothing yet says it is, rather than down.
    expect(notice().textContent).toContain("Reconnecting to the server…");
    expect(notice().textContent).toContain("3 s");
    // A wake-up that a failure started is no evidence the server is starting —
    // it may be down — so a request in the meantime is still the serious kind.
    expect(await failOnce()).toBeInstanceOf(ServerUnreachableError);
    await answer("/api/health", { status: "ok" });
    expect(notice().textContent).toContain("Preparing scores and simulations…");
    // It answered, so it was a restart: from here it is the wait again. The
    // failure still asks again, the server having gone quiet once more.
    expect(await failOnce()).toBeInstanceOf(ServerStartingError);
    expect(fetch).toHaveBeenLastCalledWith("https://backend.test/api/health");
    await answer("/api/health", { status: "ok" });
    await answer("/api/simulate_rethon/warm", { ready: true });
    wait(3000);
    expect(notice()).toBeNull();
  });

  it("says so, without a clock, when the server could not be reached", async () => {
    act(() => {
      wakeBackend();
    });
    render(<ServerWakeNotice />);
    await act(async () => {
      pending["/api/health"]({ ok: false, status: 404 });
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    expect(notice().textContent).toContain("The server could not be reached.");
    expect(notice().textContent).not.toMatch(/\d+ s$/);
  });
});
