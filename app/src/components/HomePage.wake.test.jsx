// @vitest-environment jsdom
//
// A hosted backend scales to zero, and the first request after a quiet spell
// waits for a new instance — about 25 seconds on Cloud Run. The editor's
// health check used to be that first request, so the wait began only once the
// reader was in the editor. The start page now sends it as it appears, and the
// editor joins the same request rather than sending another.
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

beforeEach(() => {
  resetBackendCapabilities();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) }),
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
  it("asks the backend's health endpoint as it appears", async () => {
    renderHome();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0][0]).toBe("https://backend.test/api/health");
  });

  it("asks once, however often it is shown", async () => {
    renderHome();
    cleanup();
    renderHome();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
