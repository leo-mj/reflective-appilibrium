// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  saveDraft,
  loadDraft,
  clearDraft,
  isWorthResuming,
} from "./draftStorage.js";

const aState = (overrides = {}) => ({
  topic: "Autonomy",
  phase: 2,
  round: 2,
  elements: [
    {
      id: "J1",
      type: "judgment",
      status: "active",
      confidence: 0.67,
      origin: "user",
      text: "A verdict",
      addedRound: 1,
    },
  ],
  relations: [],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
  ...overrides,
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

// ─── Round trip ───────────────────────────────────────────────────────────────

describe("saveDraft / loadDraft", () => {
  it("returns null when nothing has been saved", () => {
    expect(loadDraft()).toBeNull();
  });

  it("round-trips a state", () => {
    expect(saveDraft(aState())).toBe(true);
    const draft = loadDraft();
    expect(draft.state.topic).toBe("Autonomy");
    expect(draft.state.elements).toHaveLength(1);
  });

  it("stamps the save time", () => {
    saveDraft(aState());
    expect(Date.parse(loadDraft().savedAt)).not.toBeNaN();
  });

  it("keeps only the most recent draft", () => {
    saveDraft(aState({ topic: "First" }));
    saveDraft(aState({ topic: "Second" }));
    expect(loadDraft().state.topic).toBe("Second");
  });

  it("preserves item history, which is the part worth keeping", () => {
    const history = [
      { round: 2, type: "withdrawn", reason: "too broad" },
      { round: 3, type: "reinstated" },
    ];
    saveDraft(
      aState({
        round: 3,
        elements: [{ ...aState().elements[0], history }],
      }),
    );
    expect(loadDraft().state.elements[0].history).toEqual(history);
  });

  it("clearDraft removes it", () => {
    saveDraft(aState());
    clearDraft();
    expect(loadDraft()).toBeNull();
  });
});

// ─── A draft is untrusted input by the time it is read ────────────────────────

describe("loadDraft with unusable content", () => {
  it("discards a draft that is not JSON", () => {
    localStorage.setItem("reDraft", "{not json");
    expect(loadDraft()).toBeNull();
  });

  it("discards a draft whose state fails validation", () => {
    // A shape an older version of the app might have written.
    localStorage.setItem(
      "reDraft",
      JSON.stringify({ state: { topic: "x" }, savedAt: "2026-01-01" }),
    );
    expect(loadDraft()).toBeNull();
  });

  it("discards a draft with an invalid element", () => {
    const bad = aState();
    bad.elements[0].status = "imaginary";
    localStorage.setItem(
      "reDraft",
      JSON.stringify({ state: bad, savedAt: "2026-01-01" }),
    );
    expect(loadDraft()).toBeNull();
  });

  it("removes the unusable draft rather than failing on it again", () => {
    localStorage.setItem("reDraft", "{not json");
    loadDraft();
    expect(localStorage.getItem("reDraft")).toBeNull();
  });
});

// ─── Failures must not interrupt the user ─────────────────────────────────────

describe("storage failures", () => {
  it("saveDraft reports failure instead of throwing when storage is denied", () => {
    // Private browsing modes deny localStorage outright.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => saveDraft(aState())).not.toThrow();
    expect(saveDraft(aState())).toBe(false);
  });

  it("loadDraft returns null instead of throwing when storage is denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(loadDraft()).toBeNull();
  });

  it("clearDraft does not throw when storage is denied", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(() => clearDraft()).not.toThrow();
  });

  it("refuses a draft too large to be worth storing", () => {
    const huge = aState({ topic: "x".repeat(3_000_000) });
    expect(saveDraft(huge)).toBe(false);
  });
});

// ─── isWorthResuming ──────────────────────────────────────────────────────────

describe("isWorthResuming", () => {
  it("is false for no draft", () => {
    expect(isWorthResuming(null)).toBe(false);
  });

  it("is false for a process with nothing in it", () => {
    // An untouched starting state should not prompt on every visit.
    expect(isWorthResuming({ state: aState({ elements: [] }) })).toBe(false);
  });

  it("is true once there is an element", () => {
    expect(isWorthResuming({ state: aState() })).toBe(true);
  });

  it("tolerates a malformed draft", () => {
    expect(isWorthResuming({})).toBe(false);
    expect(isWorthResuming({ state: {} })).toBe(false);
  });
});
