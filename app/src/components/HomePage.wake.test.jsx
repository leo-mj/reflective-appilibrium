// @vitest-environment jsdom
//
// A hosted backend scales to zero, and the first request after a quiet spell
// waits for a new instance — about 25 seconds on Cloud Run. The editor's
// health check used to be that first request, so the wait began only once the
// reader was in the editor. The start page now sends it as it appears, and the
// editor joins the same request rather than sending another. Then it asks the
// backend to start its workers, which is most of what is left of the wait.
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";

vi.mock("../config.js", async (importOriginal) => ({
  ...(await importOriginal()),
  BACKEND_ENABLED: true,
  BACKEND_URL: "https://backend.test",
}));

const { HomePage } = await import("./HomePage.jsx");
const { resetBackendCapabilities } =
  await import("../hooks/useBackendCapabilities.js");
const { resetBackendWake } = await import("../utils/wakeBackend.js");

beforeEach(() => {
  resetBackendCapabilities();
  resetBackendWake();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", ready: true }),
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const renderHome = () =>
  render(
    <HomePage
      onStartFresh={() => {}}
      onLoadSample={() => {}}
      onLoadQuestionnaire={() => {}}
      onLoadSession={() => {}}
    />,
  );

describe("the start page in the backend build", () => {
  it("asks for the backend's health as it appears, then warms its workers", async () => {
    renderHome();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[0][0]).toBe("https://backend.test/api/health");
    expect(fetch.mock.calls[1][0]).toBe(
      "https://backend.test/api/simulate_rethon/warm",
    );
  });

  it("wakes it once, however often it is shown", async () => {
    renderHome();
    cleanup();
    renderHome();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 20));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
