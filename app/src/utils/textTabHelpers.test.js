import { describe, it, expect } from "vitest";
import {
  buildPrincipleCovers,
  matchesSearch,
  matchesSearchRel,
} from "./textTabHelpers.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const el = (id, type, overrides = {}) => ({
  id,
  type,
  status: "active",
  confidence: 1,
  origin: "user",
  text: `Text for ${id}`,
  addedRound: 1,
  ...overrides,
});

const rel = (from, to, type = "supports") => ({
  from,
  to,
  type,
  explanation: "",
  addedRound: 1,
});

/** Runs buildPrincipleCovers over a whole element list, with everything visible. */
function coversFor(elements, relations) {
  const principles = elements.filter((e) => e.type === "principle");
  const visIds = new Set(elements.map((e) => e.id));
  return buildPrincipleCovers(principles, relations, visIds, elements);
}

// ─── buildPrincipleCovers ─────────────────────────────────────────────────────

describe("buildPrincipleCovers", () => {
  it("gives every principle an entry, even with no relations", () => {
    const elements = [el("P1", "principle"), el("P2", "principle")];
    expect(coversFor(elements, [])).toEqual({ P1: [], P2: [] });
  });

  it("records a judgment a principle supports", () => {
    const elements = [el("P1", "principle"), el("J1", "judgment")];
    expect(coversFor(elements, [rel("P1", "J1")])).toEqual({ P1: ["J1"] });
  });

  it("records the relation in either direction", () => {
    // A judgment supporting a principle is the same coverage fact as the
    // reverse, so the section reads the same whichever way the user drew it.
    const elements = [el("P1", "principle"), el("J1", "judgment")];
    expect(coversFor(elements, [rel("J1", "P1")])).toEqual({ P1: ["J1"] });
  });

  it("collects several judgments under one principle", () => {
    const elements = [
      el("P1", "principle"),
      el("J1", "judgment"),
      el("J2", "judgment"),
    ];
    const covers = coversFor(elements, [rel("P1", "J1"), rel("J2", "P1")]);
    expect(covers.P1.sort()).toEqual(["J1", "J2"]);
  });

  it("ignores relation types other than supports", () => {
    const elements = [el("P1", "principle"), el("J1", "judgment")];
    for (const type of ["conflicts", "undermines", "depends", "entails"]) {
      expect(coversFor(elements, [rel("P1", "J1", type)])).toEqual({ P1: [] });
    }
  });

  it("ignores principle-to-principle and judgment-to-judgment support", () => {
    const elements = [
      el("P1", "principle"),
      el("P2", "principle"),
      el("J1", "judgment"),
      el("J2", "judgment"),
    ];
    const covers = coversFor(elements, [rel("P1", "P2"), rel("J1", "J2")]);
    expect(covers).toEqual({ P1: [], P2: [] });
  });

  it("ignores a theory supporting a principle", () => {
    const elements = [el("P1", "principle"), el("T1", "theory")];
    expect(coversFor(elements, [rel("T1", "P1")])).toEqual({ P1: [] });
  });

  it("skips relations touching an invisible element", () => {
    // visIds is how the caller filters out withdrawn items; a relation to one
    // must not add coverage the user cannot see.
    const elements = [el("P1", "principle"), el("J1", "judgment")];
    const principles = [elements[0]];
    const covers = buildPrincipleCovers(
      principles,
      [rel("P1", "J1")],
      new Set(["P1"]), // J1 hidden
      elements,
    );
    expect(covers).toEqual({ P1: [] });
  });

  it("does not invent an entry for a principle outside the supplied list", () => {
    const elements = [el("P1", "principle"), el("J1", "judgment")];
    const covers = buildPrincipleCovers(
      [], // no principles passed in
      [rel("P1", "J1")],
      new Set(["P1", "J1"]),
      elements,
    );
    expect(covers).toEqual({});
  });

  it("tolerates a relation naming an element that does not exist", () => {
    const elements = [el("P1", "principle")];
    expect(() => coversFor(elements, [rel("P1", "GONE")])).not.toThrow();
  });
});

// ─── matchesSearch ────────────────────────────────────────────────────────────

describe("matchesSearch", () => {
  const judgment = el("J1", "judgment", { text: "Autonomy matters" });

  it("matches on id, text, and type", () => {
    expect(matchesSearch(judgment, "J1")).toBe(true);
    expect(matchesSearch(judgment, "autonomy")).toBe(true);
    expect(matchesSearch(judgment, "judgment")).toBe(true);
  });

  it("is case-insensitive in both directions", () => {
    expect(matchesSearch(judgment, "j1")).toBe(true);
    expect(matchesSearch(judgment, "AUTONOMY")).toBe(true);
  });

  it("matches on a substring, not just a prefix", () => {
    expect(matchesSearch(judgment, "tono")).toBe(true);
  });

  it("returns false for a miss", () => {
    expect(matchesSearch(judgment, "paternalism")).toBe(false);
  });

  it("matches everything on an empty query", () => {
    expect(matchesSearch(judgment, "")).toBe(true);
  });
});

// ─── matchesSearchRel ─────────────────────────────────────────────────────────

describe("matchesSearchRel", () => {
  const relation = {
    from: "J1",
    to: "P1",
    type: "supports",
    explanation: "Because autonomy",
    addedRound: 1,
  };

  it("matches on either endpoint and on the explanation", () => {
    expect(matchesSearchRel(relation, "J1")).toBe(true);
    expect(matchesSearchRel(relation, "P1")).toBe(true);
    expect(matchesSearchRel(relation, "autonomy")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesSearchRel(relation, "j1")).toBe(true);
    expect(matchesSearchRel(relation, "BECAUSE")).toBe(true);
  });

  it("returns false for a miss", () => {
    expect(matchesSearchRel(relation, "paternalism")).toBe(false);
  });

  it("handles a relation with no explanation", () => {
    // Relations added before the field existed, and hand-built ones, have none.
    const bare = { ...relation, explanation: undefined };
    expect(() => matchesSearchRel(bare, "anything")).not.toThrow();
    expect(matchesSearchRel(bare, "J1")).toBe(true);
    expect(matchesSearchRel(bare, "autonomy")).toBe(false);
  });
});
