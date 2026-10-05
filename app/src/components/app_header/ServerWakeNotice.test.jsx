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
const { fetchBackend, ServerStartingError } =
  await import("../../utils/backendError.js");

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
    expect(notice().textContent).toContain("Starting the server.");
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
    expect(notice().textContent).toContain("Preparing scores and simulations.");
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

  // A hosted backend scales to zero behind a page left open. The next request
  // reaches no server; it fails with its own kind of error, and the notice
  // comes back for the new start.
  it("comes back when a later request reaches no server, and the server is woken again", async () => {
    act(() => {
      wakeBackend();
    });
    render(<ServerWakeNotice />);
    await answer("/api/health", { status: "ok" });
    await answer("/api/simulate_rethon/warm", { ready: true });
    expect(notice()).toBeNull();

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
    expect(failure).toBeInstanceOf(ServerStartingError);
    expect(fetch).toHaveBeenLastCalledWith("https://backend.test/api/health");

    wait(3000);
    expect(notice().textContent).toContain("Starting the server.");
    expect(notice().textContent).toContain("3 s");
    await answer("/api/health", { status: "ok" });
    expect(notice().textContent).toContain("Preparing scores and simulations.");
    await answer("/api/simulate_rethon/warm", { ready: true });
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
