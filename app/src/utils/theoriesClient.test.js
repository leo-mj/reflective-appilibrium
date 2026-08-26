// @vitest-environment jsdom
//
// Same strategy as judgmentsClient.test.js: vi.doMock + vi.resetModules injects a
// fresh config.js per test so the LLM_ENABLED branch can be exercised both ways
// without real network calls.
import { vi, describe, it, expect, afterEach } from "vitest";
import sampleTheories from "../sample-data/sample-theories.js";

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
  topic: "Obligations to future generations",
  round: 4,
  elements: [
    {
      id: "P1",
      type: "principle",
      status: "active",
      confidence: 0.67,
      text: "A principle",
      addedRound: 1,
    },
  ],
  relations: [],
  log: [],
  ...overrides,
});

describe("fetchTheorySuggestions", () => {
  it("prod: returns the sample theories, never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.doMock("../config.js", () => ({ LLM_ENABLED: false }));
    const { fetchTheorySuggestions } = await import("./theoriesClient.js");

    const result = await fetchTheorySuggestions(aState(), false);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual(sampleTheories);
  });

  it("dev: honours the sample toggle without calling out", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.doMock("../config.js", () => ({ LLM_ENABLED: true }));
    openaiStub();
    const { fetchTheorySuggestions } = await import("./theoriesClient.js");

    expect(await fetchTheorySuggestions(aState(), true)).toEqual(sampleTheories);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("puts the topic and the elements on the wire", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [], model: "m" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    vi.doMock("../config.js", () => ({ LLM_ENABLED: true }));
    openaiStub();
    const { fetchTheorySuggestions } = await import("./theoriesClient.js");

    await fetchTheorySuggestions(aState(), false);

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.topic).toBe("Obligations to future generations");
    expect(body.elements).toHaveLength(1);
  });

  it("surfaces a backend failure rather than swallowing it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => "bad" }),
    );
    vi.doMock("../config.js", () => ({ LLM_ENABLED: true }));
    openaiStub();
    const { fetchTheorySuggestions } = await import("./theoriesClient.js");

    await expect(fetchTheorySuggestions(aState(), false)).rejects.toThrow(/502/);
  });
});

describe("the sample fixture", () => {
  // makeLLMClient returns dummyData without running transformResponse, so the
  // fixture has to arrive in the shape useSuggestionWorkflow destructures.
  it("is already in the shape the hook consumes", () => {
    expect(sampleTheories.model).toBeTruthy();
    expect(sampleTheories.suggestions.length).toBeGreaterThan(0);
  });

  it("covers every verification state the card can render", () => {
    // The demo build has no backend, so nothing here is ever checked at runtime:
    // if the fixture does not carry the states, they are never seen at all.
    const states = sampleTheories.suggestions
      .flatMap((s) => s.sources)
      .map((s) => s.verification);
    expect(states).toContain("matched");
    expect(states).toContain("not_found");
  });

  it("includes a suggestion with no sources at all", () => {
    // A permitted and often preferable answer, and a distinct thing to render.
    expect(sampleTheories.suggestions.some((s) => s.sources.length === 0)).toBe(true);
  });

  it("says nothing about how a theory relates to existing elements", () => {
    // The tab offers plausible theories and their references. Which relations
    // hold is the Relations tab's business, and a theory arriving pre-annotated
    // would put the model's reading of the connection ahead of the user's.
    for (const s of sampleTheories.suggestions) {
      expect(s).not.toHaveProperty("bearings");
      expect(Object.keys(s).sort()).toEqual(["confidence", "sources", "text"]);
    }
  });

  it("carries a DOI only where Crossref confirmed the work", () => {
    // A DOI is never the model's to supply, so one on an unconfirmed reference
    // would misrepresent where it came from.
    for (const source of sampleTheories.suggestions.flatMap((s) => s.sources)) {
      if (source.verification !== "matched") expect(source.doi).toBe("");
    }
  });
});
