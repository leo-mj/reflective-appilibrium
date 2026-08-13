import { describe, it, expect } from "vitest";
import { computeCoherence } from "./coherence.js";

const el = (id, overrides = {}) => ({
  id,
  type: id.startsWith("P") ? "principle" : id.startsWith("T") ? "theory" : "judgment",
  status: "active",
  confidence: 1,
  origin: "user",
  text: `Text for ${id}`,
  addedRound: 1,
  ...overrides,
});

const rel = (from, to, type = "supports", overrides = {}) => ({
  from,
  to,
  type,
  explanation: "",
  addedRound: 1,
  ...overrides,
});

// ─── Tensions ─────────────────────────────────────────────────────────────────

describe("tensions", () => {
  it("reports a conflict between two held elements", () => {
    const { tensions } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "conflicts")],
    );
    expect(tensions).toEqual(["J1 conflicts P1"]);
  });

  it("reports an undermining", () => {
    const { tensions } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "undermines")],
    );
    expect(tensions).toEqual(["J1 undermines P1"]);
  });

  it("ignores relation types that are not tensions", () => {
    const elements = [el("J1"), el("P1")];
    for (const type of ["supports", "depends", "entails", "jointly_entails"]) {
      expect(computeCoherence(elements, [rel("J1", "P1", type)]).tensions).toEqual(
        [],
      );
    }
  });

  it("keeps a conflict and an undermining between the same pair apart", () => {
    // They are different observations about the same pair, not a duplicate.
    const { tensions } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "conflicts"), rel("J1", "P1", "undermines")],
    );
    expect(tensions).toHaveLength(2);
  });

  it("does not repeat an identical relation recorded twice", () => {
    const { tensions } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "conflicts"), rel("J1", "P1", "conflicts")],
    );
    expect(tensions).toEqual(["J1 conflicts P1"]);
  });

  it("treats the two directions as separate tensions", () => {
    const { tensions } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "conflicts"), rel("P1", "J1", "conflicts")],
    );
    expect(tensions).toEqual(["J1 conflicts P1", "P1 conflicts J1"]);
  });
});

// ─── What counts as held ──────────────────────────────────────────────────────

describe("elements no longer held", () => {
  it.each(["withdrawn", "rejected", "possible"])(
    "drops a tension with a %s element",
    (status) => {
      // A conflict with a commitment you have given up is not a tension you
      // still have.
      const { tensions } = computeCoherence(
        [el("J1"), el("P1", { status })],
        [rel("J1", "P1", "conflicts")],
      );
      expect(tensions).toEqual([]);
    },
  );

  it.each(["withdrawn", "rejected", "possible"])(
    "does not list a %s element as an orphan",
    (status) => {
      const { orphans } = computeCoherence([el("J1", { status })], []);
      expect(orphans).toEqual([]);
    },
  );

  it("counts a revised element as held", () => {
    const { orphans } = computeCoherence([el("J1", { status: "revised" })], []);
    expect(orphans).toHaveLength(1);
  });

  it("ignores a withdrawn relation", () => {
    const { tensions } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "conflicts", { status: "withdrawn" })],
    );
    expect(tensions).toEqual([]);
  });

  it("reads a relation's withdrawal from its history", () => {
    const { tensions } = computeCoherence(
      [el("J1"), el("P1")],
      [
        rel("J1", "P1", "conflicts", {
          history: [{ round: 2, type: "withdrawn" }],
        }),
      ],
    );
    expect(tensions).toEqual([]);
  });

  it("counts a relation that was withdrawn and reinstated", () => {
    const { tensions } = computeCoherence(
      [el("J1"), el("P1")],
      [
        rel("J1", "P1", "conflicts", {
          history: [
            { round: 2, type: "withdrawn" },
            { round: 3, type: "reinstated" },
          ],
        }),
      ],
    );
    expect(tensions).toEqual(["J1 conflicts P1"]);
  });
});

// ─── Orphans ──────────────────────────────────────────────────────────────────

describe("orphans", () => {
  it("lists an element with no relations at all", () => {
    const { orphans } = computeCoherence([el("J1")], []);
    expect(orphans).toEqual(["J1 — not related to anything else"]);
  });

  it("does not list an element that is related in either direction", () => {
    const elements = [el("J1"), el("P1")];
    expect(computeCoherence(elements, [rel("J1", "P1")]).orphans).toEqual([]);
    expect(computeCoherence(elements, [rel("P1", "J1")]).orphans).toEqual([]);
  });

  it("counts a tension as a connection", () => {
    // Being in conflict with something is still being attached to it.
    const { orphans } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "conflicts")],
    );
    expect(orphans).toEqual([]);
  });

  it("lists an element whose only relation points at a withdrawn one", () => {
    // It is an orphan in fact, even though a relation exists on paper.
    const { orphans } = computeCoherence(
      [el("J1"), el("P1", { status: "withdrawn" })],
      [rel("J1", "P1")],
    );
    expect(orphans).toEqual(["J1 — not related to anything else"]);
  });

  it("lists several orphans in element order", () => {
    const { orphans } = computeCoherence([el("J1"), el("P1"), el("T1")], []);
    expect(orphans.map((o) => o.split(" ")[0])).toEqual(["J1", "P1", "T1"]);
  });
});

// ─── Following what the graph is drawing ──────────────────────────────────────

// With arguments-only mode on — the default — plain relations are not on
// screen. Counting them here described a graph the reader could not see:
// tensions with no edge behind them, and elements that looked stranded going
// unlisted because of a relation that was being hidden.
describe("arguments-only mode", () => {
  const argsOnly = { showRelations: false };

  it("drops a tension carried by a plain relation", () => {
    const { tensions } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "undermines")],
      argsOnly,
    );
    expect(tensions).toEqual([]);
  });

  it("keeps a tension carried by an argument relation", () => {
    // Precluding says the premises entail the negation of the conclusion, and
    // it is drawn in the graph either way.
    const { tensions } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "precludes")],
      argsOnly,
    );
    expect(tensions).toEqual(["J1 precludes P1"]);
  });

  it("reads jointly_precludes without the underscore", () => {
    const { tensions } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "jointly_precludes")],
      argsOnly,
    );
    expect(tensions).toEqual(["J1 jointly precludes P1"]);
  });

  it("calls an element with only plain relations an orphan", () => {
    // It is drawn with no edges, so the section has to agree.
    const { orphans } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "supports")],
      argsOnly,
    );
    expect(orphans).toHaveLength(2);
  });

  it("does not call an element in an argument an orphan", () => {
    const { orphans } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "entails")],
      argsOnly,
    );
    expect(orphans).toEqual([]);
  });

  it("counts plain relations again once they are shown", () => {
    const elements = [el("J1"), el("P1")];
    const relations = [rel("J1", "P1", "undermines")];
    expect(computeCoherence(elements, relations, argsOnly)).toEqual({
      tensions: [],
      orphans: [
        "J1 — not related to anything else",
        "P1 — not related to anything else",
      ],
      possibleSupport: [],
    });
    expect(computeCoherence(elements, relations, { showRelations: true })).toEqual({
      tensions: ["J1 undermines P1"],
      orphans: [],
      possibleSupport: [],
    });
  });

  it("defaults to showing relations", () => {
    const { tensions } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "conflicts")],
    );
    expect(tensions).toEqual(["J1 conflicts P1"]);
  });
});

// ─── Possible support ─────────────────────────────────────────────────────────

// The one place a set-aside element is worth naming: something you withdrew may
// still support, or be supported by, what you now hold — a reason to look at it
// again rather than a defect to fix.
describe("possible support", () => {
  const withdrawn = (id) => el(id, { status: "withdrawn" });
  const rejected = (id) => el(id, { status: "rejected" });

  it("finds a held element supporting a withdrawn one", () => {
    const { possibleSupport } = computeCoherence(
      [el("J1"), withdrawn("P1")],
      [rel("J1", "P1", "supports")],
    );
    expect(possibleSupport).toEqual(["J1 supports P1 (withdrawn)"]);
  });

  it("finds a withdrawn element supporting a held one", () => {
    const { possibleSupport } = computeCoherence(
      [withdrawn("J1"), el("P1")],
      [rel("J1", "P1", "supports")],
    );
    expect(possibleSupport).toEqual(["J1 (withdrawn) supports P1"]);
  });

  it("marks a rejected element as rejected", () => {
    const { possibleSupport } = computeCoherence(
      [el("J1"), rejected("P1")],
      [rel("J1", "P1", "supports")],
    );
    expect(possibleSupport).toEqual(["J1 supports P1 (rejected)"]);
  });

  it.each(["entails", "jointly_entails"])("counts %s", (type) => {
    const { possibleSupport } = computeCoherence(
      [el("J1"), withdrawn("P1")],
      [rel("J1", "P1", type)],
    );
    expect(possibleSupport).toHaveLength(1);
  });

  it("reads jointly_entails without the underscore", () => {
    const { possibleSupport } = computeCoherence(
      [el("J1"), withdrawn("P1")],
      [rel("J1", "P1", "jointly_entails")],
    );
    expect(possibleSupport).toEqual(["J1 jointly entails P1 (withdrawn)"]);
  });

  it.each(["conflicts", "undermines", "precludes", "depends"])(
    "ignores %s, which is not support",
    (type) => {
      const { possibleSupport } = computeCoherence(
        [el("J1"), withdrawn("P1")],
        [rel("J1", "P1", type)],
      );
      expect(possibleSupport).toEqual([]);
    },
  );

  it("ignores a pair that is entirely held", () => {
    const { possibleSupport } = computeCoherence(
      [el("J1"), el("P1")],
      [rel("J1", "P1", "supports")],
    );
    expect(possibleSupport).toEqual([]);
  });

  it("ignores a pair that is entirely set aside", () => {
    // Neither end is a current commitment, so there is nothing to reconsider
    // it against.
    const { possibleSupport } = computeCoherence(
      [withdrawn("J1"), rejected("P1")],
      [rel("J1", "P1", "supports")],
    );
    expect(possibleSupport).toEqual([]);
  });

  it("ignores a withdrawn relation", () => {
    // Withdrawing the relation retracts the claim; that is not a reason to
    // reconsider the element.
    const { possibleSupport } = computeCoherence(
      [el("J1"), withdrawn("P1")],
      [rel("J1", "P1", "supports", { status: "withdrawn" })],
    );
    expect(possibleSupport).toEqual([]);
  });

  it("ignores a 'possible' element, which nobody has ruled on", () => {
    const { possibleSupport } = computeCoherence(
      [el("J1"), el("P1", { status: "possible" })],
      [rel("J1", "P1", "supports")],
    );
    expect(possibleSupport).toEqual([]);
  });

  it("does not repeat an identical relation recorded twice", () => {
    const { possibleSupport } = computeCoherence(
      [el("J1"), withdrawn("P1")],
      [rel("J1", "P1", "supports"), rel("J1", "P1", "supports")],
    );
    expect(possibleSupport).toHaveLength(1);
  });

  it("does not make the held side an orphan", () => {
    // The relation is real, so J1 is attached — just to something set aside.
    // Orphans only count relations between held elements, so it is listed.
    const { orphans, possibleSupport } = computeCoherence(
      [el("J1"), withdrawn("P1")],
      [rel("J1", "P1", "supports")],
    );
    expect(possibleSupport).toHaveLength(1);
    expect(orphans).toEqual(["J1 — not related to anything else"]);
  });

  it("drops a plain supports edge in arguments-only mode", () => {
    const elements = [el("J1"), withdrawn("P1")];
    const relations = [rel("J1", "P1", "supports")];
    expect(
      computeCoherence(elements, relations, { showRelations: false })
        .possibleSupport,
    ).toEqual([]);
    expect(
      computeCoherence(elements, relations, { showRelations: true })
        .possibleSupport,
    ).toHaveLength(1);
  });

  it("keeps an entails edge in arguments-only mode", () => {
    const { possibleSupport } = computeCoherence(
      [el("J1"), withdrawn("P1")],
      [rel("J1", "P1", "entails")],
      { showRelations: false },
    );
    expect(possibleSupport).toHaveLength(1);
  });
});

// ─── Edges ────────────────────────────────────────────────────────────────────

describe("degenerate inputs", () => {
  it("handles an empty process", () => {
    expect(computeCoherence([], [])).toEqual({
      tensions: [],
      orphans: [],
      possibleSupport: [],
    });
  });

  it("ignores a relation naming an element that does not exist", () => {
    const { tensions, orphans } = computeCoherence(
      [el("J1")],
      [rel("J1", "GONE", "conflicts")],
    );
    expect(tensions).toEqual([]);
    expect(orphans).toEqual(["J1 — not related to anything else"]);
  });
});
