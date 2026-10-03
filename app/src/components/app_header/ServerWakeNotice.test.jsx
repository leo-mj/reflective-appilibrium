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
});
