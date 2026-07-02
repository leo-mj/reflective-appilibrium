// @vitest-environment jsdom
//
// Strategy: vi.doMock + vi.resetModules lets each test inject a fresh copy of
// config.js with a specific LLM_ENABLED value before importing the real
// judgmentsClient.js. Because module imports are cached, afterEach clears
// the cache so the next test starts from a clean slate.
//
// fetch is replaced with a vi.stubGlobal spy so we can assert whether the
// network path was taken without making real HTTP requests.
import { vi, describe, it, expect, afterEach } from "vitest";
import dummyJudgments from "../dummy-data/dummy-judgments.js";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

// openaiClient is mocked in tests where LLM_ENABLED=true because the real
// implementation reads sessionStorage (for API keys) and is not relevant
// to the branching logic under test here.
const openaiStub = () =>
  vi.doMock("./openaiClient.js", () => ({
    getLLMHeaders: () => ({}),
    accumulateUsage: () => {},
  }));

// Note: the "prod + new RE process" scenario (suggestionsDisabled=true) is NOT
// tested here because fetchJudgmentElicitations is never called in that case —
// the guard lives in the JudgmentElicitTab useEffect (GraphPanel.jsx computes
// suggestionsDisabled = !LLM_ENABLED && !isSample). config.test.js covers the
// env-var → LLM_ENABLED mapping that feeds into that guard.

describe("fetchJudgmentElicitations", () => {
  it("prod + sample: returns dummy, never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.doMock("../config.js", () => ({ LLM_ENABLED: false }));
    const { fetchJudgmentElicitations } = await import("./judgmentsClient.js");

    const result = await fetchJudgmentElicitations(
      { topic: "test", elements: [], log: [] },
      false,
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual(dummyJudgments);
  });

  it("dev + sample + useDummy unchecked: calls the backend, returns real response", async () => {
    const mockResponse = { suggestions: [], model: "test-model", usage: {} };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }),
    );
    vi.doMock("../config.js", () => ({ LLM_ENABLED: true }));
    openaiStub();
    const { fetchJudgmentElicitations } = await import("./judgmentsClient.js");

    const result = await fetchJudgmentElicitations(
      { topic: "test", elements: [], log: [] },
      false,
    );

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/judgments/elicit"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("dev + sample + useDummy checked: returns dummy, never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.doMock("../config.js", () => ({ LLM_ENABLED: true }));
    openaiStub();
    const { fetchJudgmentElicitations } = await import("./judgmentsClient.js");

    const result = await fetchJudgmentElicitations(
      { topic: "test", elements: [], log: [] },
      true,
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual(dummyJudgments);
  });
});
