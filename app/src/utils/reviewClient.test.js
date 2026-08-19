// @vitest-environment jsdom
//
// Same strategy as judgmentsClient.test.js: vi.doMock + vi.resetModules injects a
// fresh config.js per test so the LLM_ENABLED branch can be exercised both ways
// without real network calls.
import { vi, describe, it, expect, afterEach } from "vitest";
import sampleReview from "../sample-data/sample-review.js";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

const openaiStub = () =>
  vi.doMock("./openaiClient.js", () => ({
    getLLMHeaders: () => ({}),
    accumulateUsage: () => {},
  }));

const aState = (overrides = {}) => ({
  topic: "t",
  round: 4,
  elements: [],
  relations: [],
  log: [],
  ...overrides,
});

describe("fetchProcessReview", () => {
  it("prod: returns the sample review, never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.doMock("../config.js", () => ({ LLM_ENABLED: false }));
    const { fetchProcessReview } = await import("./reviewClient.js");

    const result = await fetchProcessReview(aState(), false);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual(sampleReview);
  });

  it("serves the sample already shaped as one suggestion", async () => {
    // makeLLMClient returns dummyData without running transformResponse, so the
    // fixture has to arrive in the shape useSuggestionWorkflow destructures. A
    // fixture in the raw endpoint shape would make the demo build render nothing.
    expect(sampleReview.suggestions).toHaveLength(1);
    expect(Object.keys(sampleReview.suggestions[0]).sort()).toEqual([
      "arc",
      "headline",
      "method",
      "missed",
      "surprises",
    ]);
    expect(sampleReview.model).toBeTruthy();
  });

  it("sends the whole state, so earlier reviews travel with it", async () => {
    // The prior reviews ride inside `state` rather than in a field of their own;
    // dropping them here is what would silently cut the thread between reviews.
    const earlier = [{ id: "rev-1", round: 2, headline: "h" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            headline: "h",
            arc: "a",
            surprises: "s",
            missed: "m",
            method: "me",
            model: "test-model",
          }),
      }),
    );
    vi.doMock("../config.js", () => ({ LLM_ENABLED: true }));
    openaiStub();
    const { fetchProcessReview } = await import("./reviewClient.js");

    await fetchProcessReview(aState({ reviews: earlier }), false);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain("/api/review/analyze");
    expect(JSON.parse(init.body).state.reviews).toEqual(earlier);
  });

  it("reshapes the endpoint's five fields into one suggestion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            headline: "H",
            arc: "A",
            surprises: "S",
            missed: "M",
            method: "ME",
            model: "test-model",
          }),
      }),
    );
    vi.doMock("../config.js", () => ({ LLM_ENABLED: true }));
    openaiStub();
    const { fetchProcessReview } = await import("./reviewClient.js");

    const result = await fetchProcessReview(aState(), false);

    expect(result).toEqual({
      suggestions: [
        { headline: "H", arc: "A", surprises: "S", missed: "M", method: "ME" },
      ],
      model: "test-model",
    });
  });

  it("useDummy checked: returns the sample, never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.doMock("../config.js", () => ({ LLM_ENABLED: true }));
    openaiStub();
    const { fetchProcessReview } = await import("./reviewClient.js");

    const result = await fetchProcessReview(aState(), true);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual(sampleReview);
  });
});
