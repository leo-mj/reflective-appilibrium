// @vitest-environment jsdom
//
// The demo build has no backend. Every request it makes is one that fails, and
// the ones fired from effects fail repeatedly and unprompted — connection
// errors on plain http, blocked mixed content once served over https. Scoring
// fails closed either way, so the only symptom is a console full of errors on a
// public demo. These tests pin the guards that keep it quiet.
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Loads the client under `env`, with fetch stubbed out. */
const load = async (env) => {
  vi.stubEnv("VITE_APP_ENV", env);
  const fetchMock = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ withdrawal_deltas: [] }) }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return { ...(await import("./simulateRethonClient.js")), fetchMock };
};

const STATE = { elements: [], relations: [], round: 1 };

describe("scoreChanges", () => {
  it("makes no request when there is no backend", async () => {
    const { scoreChanges, fetchMock } = await load("demo");
    await expect(scoreChanges(STATE)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still calls the backend when there is one", async () => {
    const { scoreChanges, fetchMock } = await load("dev");
    await scoreChanges(STATE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/simulate_rethon/score_changes");
  });
});

describe("quickScore", () => {
  // Guarded already; asserted so the two stay consistent.
  it("makes no request when there is no backend", async () => {
    const { quickScore, fetchMock } = await load("demo");
    await expect(quickScore([], [])).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
