// @vitest-environment jsdom
//
// Same strategy as the other client tests: a fresh config.js per test, so both
// sides of LLM_ENABLED are exercised without real network calls.
import { vi, describe, it, expect, afterEach } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

const openaiStub = () =>
  vi.doMock("./openaiClient.js", () => ({
    getLLMHeaders: () => ({}),
    accumulateUsage: () => {},
  }));

const el = (id, text) => ({
  id,
  type: "judgment",
  status: "active",
  confidence: 0.7,
  text,
  addedRound: 1,
});
const state = {
  topic: "Honesty",
  round: 2,
  elements: [el("J1", "Never lie to friends."), el("J2", "Never lie to your friends.")],
  relations: [],
  log: [],
  processes: [
    { id: "A", label: "Lying", members: ["J1"] },
    { id: "B", label: "Promises", members: ["J2"] },
  ],
};

describe("fetchMergePairs", () => {
  it("serves word-overlap samples without a model, and never calls out", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.doMock("../config.js", () => ({ LLM_ENABLED: false, BACKEND_URL: "" }));
    openaiStub();
    const { fetchMergePairs } = await import("./elementMergeClient.js");

    const result = await fetchMergePairs(state);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.model).toBe("sample");
    expect(result.suggestions.map((p) => [p.a, p.b])).toEqual([["J1", "J2"]]);
  });

  it("posts the elements and the process record to the merge endpoint", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [{ a: "J1", b: "J2", reason: "r" }], model: "m" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    vi.doMock("../config.js", () => ({ LLM_ENABLED: true, BACKEND_URL: "http://b" }));
    openaiStub();
    const { fetchMergePairs } = await import("./elementMergeClient.js");

    const result = await fetchMergePairs(state);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://b/api/merge/pairs");
    expect(JSON.parse(init.body)).toEqual({
      topic: "Honesty",
      elements: state.elements,
      processes: state.processes,
    });
    expect(result).toEqual({ suggestions: [{ a: "J1", b: "J2", reason: "r" }], model: "m" });
  });
});
