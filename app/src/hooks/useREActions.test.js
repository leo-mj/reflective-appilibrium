// @vitest-environment jsdom
import { StrictMode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useREActions } from "./useREActions.js";
import { textAtRound, isWithdrawnNow } from "../utils/stateUtils.js";

vi.mock("../utils/importMarkdown.js", () => ({
  importStateFromFile: vi.fn(),
}));
import { importStateFromFile } from "../utils/importMarkdown.js";

afterEach(() => vi.clearAllMocks());

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    id: "J1",
    type: "judgment",
    status: "active",
    confidence: 1.0,
    origin: "user",
    text: "Original text",
    addedRound: 1,
    ...overrides,
  };
}

function makeRel(overrides = {}) {
  return {
    from: "J1",
    to: "P1",
    type: "supports",
    explanation: "J1 supports P1",
    addedRound: 1,
    ...overrides,
  };
}

function baseState(overrides = {}) {
  return {
    topic: "Test topic",
    phase: 1,
    round: 1,
    elements: [makeEl()],
    relations: [makeRel()],
    coherence: { tensions: [], orphans: [], clusters: [] },
    log: [],
    ...overrides,
  };
}

// ─── handleAddElement ─────────────────────────────────────────────────────────

describe("handleAddElement", () => {
  it("appends element with generated id, active status, and addedRound", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddElement({
        type: "judgment",
        text: "New judgment",
        confidence: 0.67,
        origin: "user",
      });
    });
    const els = result.current.state.elements;
    expect(els).toHaveLength(2);
    expect(els[1].id).toBe("J2");
    expect(els[1].status).toBe("active");
    expect(els[1].addedRound).toBe(2);
    expect(els[1].text).toBe("New judgment");
  });

  it("increments state.round", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: 1.0, origin: "user" });
    });
    expect(result.current.state.round).toBe(2);
  });

  it("appends a log entry with decision 'Added'", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: 1.0, origin: "user" });
    });
    expect(result.current.state.log).toHaveLength(1);
    expect(result.current.state.log[0].decision).toBe("Added");
    expect(result.current.state.log[0].round).toBe(2);
  });

  it("sets recentlyAdded to the new element id and clears recentlyAddedRel", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    // Populate recentlyAddedRel first so the clearing assertion is non-vacuous
    act(() => {
      result.current.handleAddRelation({ from: "J1", to: "P1", type: "conflicts", explanation: "" });
    });
    expect(result.current.recentlyAddedRel).not.toBeNull();
    act(() => {
      result.current.handleAddElement({ type: "principle", text: "P", confidence: 1.0, origin: "user" });
    });
    expect(result.current.recentlyAdded).toBe("P1");
    expect(result.current.recentlyAddedRel).toBeNull();
  });

  it("clears selected", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleSelectNode("J1"));
    expect(result.current.selected).toBe("J1");
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: 1.0, origin: "user" });
    });
    expect(result.current.selected).toBeNull();
  });

  it("clears selectedRel", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    const rel = result.current.state.relations[0];
    act(() => result.current.handleSelectRel(rel));
    expect(result.current.selectedRel).toBe(rel);
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: 1.0, origin: "user" });
    });
    expect(result.current.selectedRel).toBeNull();
  });

  it("generates IDs independently per type", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    act(() => {
      result.current.handleAddElement({ type: "principle", text: "P", confidence: 1.0, origin: "user" });
    });
    expect(result.current.state.elements[0].id).toBe("P1");
    act(() => {
      result.current.handleAddElement({ type: "theory", text: "T", confidence: 1.0, origin: "user" });
    });
    expect(result.current.state.elements[1].id).toBe("T1");
  });
});

// ─── handleAddRelation ────────────────────────────────────────────────────────

describe("handleAddRelation", () => {
  it("appends relation with addedRound set to next round", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddRelation({ from: "J1", to: "P1", type: "conflicts", explanation: "They conflict" });
    });
    const rels = result.current.state.relations;
    expect(rels).toHaveLength(2);
    expect(rels[1].type).toBe("conflicts");
    expect(rels[1].addedRound).toBe(2);
  });

  it("groups an argument type under a generated argumentId", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddRelation({ from: "J1", to: "P1", type: "entails", explanation: "" });
    });
    expect(result.current.state.relations.at(-1).argumentId).toMatch(/^arg-/);
  });

  it("leaves a dialectical type ungrouped", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddRelation({ from: "J1", to: "P1", type: "supports", explanation: "" });
    });
    expect(result.current.state.relations.at(-1).argumentId).toBeUndefined();
  });

  it("keeps a caller-supplied argumentId so joint premises stay together", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddRelation({
        from: "J1", to: "P1", type: "jointly_entails", argumentId: "arg-fixed", explanation: "",
      });
    });
    expect(result.current.state.relations.at(-1).argumentId).toBe("arg-fixed");
  });

  it("pins the new relation without selecting it when pinRecent is set", () => {
    // How the argument panels add the last premise: highlight it, but leave the
    // user's current selection alone.
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleSelectNode("J1"));
    act(() => {
      result.current.handleAddRelation(
        { from: "J1", to: "P1", type: "supports", explanation: "" },
        { select: false, pinRecent: true },
      );
    });
    expect(result.current.recentlyAddedRel).toMatchObject({ from: "J1", to: "P1" });
    expect(result.current.recentlyAdded).toBeNull();
    expect(result.current.selected).toBe("J1");
  });

  it("leaves a withdrawn endpoint withdrawn", () => {
    // An argument may rest on a premise that was withdrawn later; recording it
    // must not quietly bring that premise back into the position.
    const withdrawn = makeEl({ id: "J2", status: "withdrawn", withdrawnRound: 1 });
    const { result } = renderHook(() =>
      useREActions(baseState({ elements: [makeEl(), withdrawn] })),
    );
    act(() => {
      result.current.handleAddRelation({ from: "J2", to: "P1", type: "entails", explanation: "" });
    });
    expect(result.current.state.elements.find((e) => e.id === "J2")).toEqual(withdrawn);
  });

  it("increments state.round and appends a log entry", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddRelation({ from: "J1", to: "P1", type: "supports", explanation: "" });
    });
    expect(result.current.state.round).toBe(2);
    expect(result.current.state.log).toHaveLength(1);
    expect(result.current.state.log[0].decision).toBe("Added");
  });

  it("sets recentlyAddedRel and clears selected when select=true (default)", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleSelectNode("J1"));
    expect(result.current.selected).toBe("J1");
    act(() => {
      result.current.handleAddRelation({ from: "J1", to: "P1", type: "supports", explanation: "" });
    });
    expect(result.current.recentlyAddedRel).toMatchObject({ from: "J1", to: "P1", type: "supports", addedRound: 2 });
    expect(result.current.selected).toBeNull();
  });

  it("clears recentlyAdded when select=true (default)", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    // Populate recentlyAdded via an element add, then add a relation and assert it's cleared
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: 1.0, origin: "user" });
    });
    expect(result.current.recentlyAdded).toBe("J2");
    act(() => {
      result.current.handleAddRelation({ from: "J1", to: "P1", type: "supports", explanation: "" });
    });
    expect(result.current.recentlyAdded).toBeNull();
  });

  it("does not update recentlyAddedRel when select=false", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    // Set recentlyAddedRel to a known value first
    act(() => {
      result.current.handleAddRelation({ from: "J1", to: "P1", type: "conflicts", explanation: "" });
    });
    const firstRel = result.current.recentlyAddedRel;
    expect(firstRel).not.toBeNull();
    // Adding with select=false should leave recentlyAddedRel unchanged
    act(() => {
      result.current.handleAddRelation(
        { from: "J1", to: "P1", type: "depends", explanation: "" },
        { select: false },
      );
    });
    expect(result.current.recentlyAddedRel).toBe(firstRel);
  });
});

// ─── handleEditSave ───────────────────────────────────────────────────────────

describe("handleEditSave", () => {
  it("updates element text and sets status to 'revised'", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    act(() => {
      result.current.handleEditSave({ text: "Updated text", confidence: 1.0, type: "judgment", origin: "user" });
    });
    const el = result.current.state.elements[0];
    expect(el.text).toBe("Updated text");
    expect(el.status).toBe("revised");
  });

  it("stores original text in previousText and sets revisedRound", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    act(() => {
      result.current.handleEditSave({ text: "New text", confidence: 1.0, type: "judgment", origin: "user" });
    });
    const el = result.current.state.elements[0];
    expect(el.previousText).toBe("Original text");
    expect(el.revisedRound).toBe(2);
  });

  it("strips withdrawnRound and reason from the revised element", () => {
    const elWithWithdrawn = makeEl({ withdrawnRound: 1, reason: "old reason" });
    const { result } = renderHook(() => useREActions(baseState({ elements: [elWithWithdrawn] })));
    act(() => result.current.handleEditRequest("J1"));
    act(() => {
      result.current.handleEditSave({ text: "New text", confidence: 1.0, type: "judgment", origin: "user" });
    });
    const el = result.current.state.elements[0];
    expect(el.withdrawnRound).toBeUndefined();
    expect(el.reason).toBeUndefined();
  });

  it("increments state.round", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    act(() => {
      result.current.handleEditSave({ text: "x", confidence: 1.0, type: "judgment", origin: "user" });
    });
    expect(result.current.state.round).toBe(2);
  });

  it("appends log entry with diff string when fields changed", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    act(() => {
      result.current.handleEditSave({ text: "New text", confidence: 0.33, type: "judgment", origin: "user" });
    });
    const { changes } = result.current.state.log[0];
    expect(changes).toContain("text:");
    expect(changes).toContain("confidence:");
  });

  it("appends log entry noting 'No fields changed' when nothing differs", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    act(() => {
      result.current.handleEditSave({
        text: "Original text",
        confidence: 1.0,
        type: "judgment",
        origin: "user",
        status: "active",
      });
    });
    expect(result.current.state.log[0].changes).toBe("No fields changed");
  });

  it("clears editingEl after save", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    expect(result.current.editingEl).not.toBeNull();
    act(() => {
      result.current.handleEditSave({ text: "x", confidence: 1.0, type: "judgment", origin: "user" });
    });
    expect(result.current.editingEl).toBeNull();
  });
});

// ─── handleReviseElementText ──────────────────────────────────────────────────
//
// Used by Detect Arguments when the user rewords an existing premise so the
// reconstruction goes through. Must record the same revision bookkeeping as the
// edit modal, and must not fire when the text is unchanged.

describe("handleReviseElementText", () => {
  it("updates text and records the revision like handleEditSave does", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleReviseElementText("J1", "Reworded text"));
    const el = result.current.state.elements[0];
    expect(el.text).toBe("Reworded text");
    expect(el.status).toBe("revised");
    expect(el.previousText).toBe("Original text");
    expect(el.revisedRound).toBe(2);
    expect(result.current.state.round).toBe(2);
  });

  it("marks an LLM-authored element as user-edited", () => {
    const { result } = renderHook(() =>
      useREActions(baseState({ elements: [makeEl({ origin: "gpt-4o" })] })),
    );
    act(() => result.current.handleReviseElementText("J1", "Reworded text"));
    expect(result.current.state.elements[0].origin).toBe("gpt-4o & user");
  });

  it("leaves a user-authored origin unchanged", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleReviseElementText("J1", "Reworded text"));
    expect(result.current.state.elements[0].origin).toBe("user");
  });

  it("is a no-op when the text is unchanged", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleReviseElementText("J1", "Original text"));
    expect(result.current.state.elements[0].status).toBe("active");
    expect(result.current.state.round).toBe(1);
    expect(result.current.state.log).toHaveLength(0);
  });

  it("is a no-op for an unknown element id", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleReviseElementText("J99", "Reworded text"));
    expect(result.current.state.elements[0].text).toBe("Original text");
    expect(result.current.state.round).toBe(1);
  });

  it("leaves other elements untouched", () => {
    const { result } = renderHook(() =>
      useREActions(
        baseState({
          elements: [makeEl(), makeEl({ id: "P1", type: "principle" })],
        }),
      ),
    );
    act(() => result.current.handleReviseElementText("J1", "Reworded text"));
    const p1 = result.current.state.elements[1];
    expect(p1.text).toBe("Original text");
    expect(p1.status).toBe("active");
  });
});

// ─── handleRelEditSave ────────────────────────────────────────────────────────

describe("handleRelEditSave", () => {
  it("updates relation type and explanation and sets status to 'revised'", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.setEditingRel(result.current.state.relations[0]));
    act(() => {
      result.current.handleRelEditSave({ type: "conflicts", explanation: "Actually conflicts" });
    });
    const rel = result.current.state.relations[0];
    expect(rel.type).toBe("conflicts");
    expect(rel.explanation).toBe("Actually conflicts");
    expect(rel.status).toBe("revised");
  });

  it("sets revisedRound to the new round", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.setEditingRel(result.current.state.relations[0]));
    act(() => {
      result.current.handleRelEditSave({ type: "conflicts", explanation: "x" });
    });
    expect(result.current.state.relations[0].revisedRound).toBe(2);
  });

  it("increments state.round and appends a log entry", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.setEditingRel(result.current.state.relations[0]));
    act(() => {
      result.current.handleRelEditSave({ type: "conflicts", explanation: "x" });
    });
    expect(result.current.state.round).toBe(2);
    expect(result.current.state.log).toHaveLength(1);
  });

  it("clears editingRel after save", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.setEditingRel(result.current.state.relations[0]));
    act(() => {
      result.current.handleRelEditSave({ type: "conflicts", explanation: "x" });
    });
    expect(result.current.editingRel).toBeNull();
  });
});

// ─── Revision history ─────────────────────────────────────────────────────────

describe("revision history", () => {
  it("keeps every wording, not just the last", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleReviseElementText("J1", "Second wording"));
    act(() => result.current.handleReviseElementText("J1", "Third wording"));

    const el = result.current.state.elements[0];
    expect(el.text).toBe("Third wording");
    expect(el.history).toEqual([
      { round: 2, type: "revised", previousText: "Original text" },
      { round: 3, type: "revised", previousText: "Second wording" },
    ]);
    // The first wording used to be unrecoverable after the second edit.
    expect(textAtRound(el, 1)).toBe("Original text");
    expect(textAtRound(el, 2)).toBe("Second wording");
    expect(textAtRound(el, 3)).toBe("Third wording");
  });

  it("brings a withdrawn element back when reworded on argument accept", () => {
    // Withdrawn premises are selectable when reconstructing an argument, so a
    // rewording can land on one; leaving the withdrawal open would contradict
    // the "revised" status it gets.
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleWithdrawConfirm("J1", "Too broad"));
    act(() => result.current.handleReviseElementText("J1", "Reworded"));

    const el = result.current.state.elements[0];
    expect(el.status).toBe("revised");
    expect(el.history.map((h) => [h.round, h.type])).toEqual([
      [2, "withdrawn"],
      [3, "reinstated"],
      [3, "revised"],
    ]);
    expect(isWithdrawnNow(el)).toBe(false);
  });

  it("records a relation's previous explanation", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.setEditingRel(result.current.state.relations[0]));
    act(() =>
      result.current.handleRelEditSave({
        type: "supports",
        explanation: "Reworded",
      }),
    );
    expect(result.current.state.relations[0].history).toEqual([
      { round: 2, type: "revised", previousText: "J1 supports P1" },
    ]);
  });

  it("records reinstatement when a withdrawn element is revised", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleWithdrawConfirm("J1", "Too broad"));
    act(() => result.current.handleEditRequest("J1"));
    act(() =>
      result.current.handleEditSave({
        type: "judgment",
        confidence: 1.0,
        origin: "user",
        text: "Reworded",
      }),
    );
    const el = result.current.state.elements[0];
    expect(el.status).toBe("revised");
    expect(el.history.map((h) => [h.round, h.type])).toEqual([
      [2, "withdrawn"],
      [3, "reinstated"],
      [3, "revised"],
    ]);
  });
});

// ─── handleApplyRethonEquilibrium ─────────────────────────────────────────────

describe("handleApplyRethonEquilibrium", () => {
  const state = () =>
    baseState({
      elements: [
        makeEl({ id: "J1" }),
        makeEl({ id: "J2" }),
        makeEl({ id: "J3", status: "withdrawn", withdrawnRound: 1 }),
        makeEl({ id: "J4", status: "rejected", rejectedRound: 1 }),
      ],
    });
  const byId = (result, id) =>
    result.current.state.elements.find((e) => e.id === id);

  it("withdraws everything outside the commitment set", () => {
    const { result } = renderHook(() => useREActions(state()));
    act(() => result.current.handleApplyRethonEquilibrium(new Set(["J1"])));
    expect(byId(result, "J1").status).toBe("active");
    expect(byId(result, "J2").status).toBe("withdrawn");
    expect(byId(result, "J2").reason).toMatch(/rethon/i);
  });

  it("records the withdrawal as an event", () => {
    const { result } = renderHook(() => useREActions(state()));
    act(() => result.current.handleApplyRethonEquilibrium(new Set(["J1"])));
    expect(byId(result, "J2").history).toEqual([
      { round: 2, type: "withdrawn", reason: expect.stringMatching(/rethon/i) },
    ]);
  });

  it("leaves already-withdrawn and rejected elements untouched", () => {
    const before = state();
    const { result } = renderHook(() => useREActions(before));
    act(() => result.current.handleApplyRethonEquilibrium(new Set(["J1"])));
    expect(byId(result, "J3")).toEqual(before.elements[2]);
    expect(byId(result, "J4")).toEqual(before.elements[3]);
  });

  it("bumps the round and logs what was retained", () => {
    const { result } = renderHook(() => useREActions(state()));
    act(() => result.current.handleApplyRethonEquilibrium(new Set(["J1"])));
    expect(result.current.state.round).toBe(2);
    expect(result.current.state.log.at(-1).changes).toContain("J1");
  });
});

// ─── handleDeleteRelationsByArgId ─────────────────────────────────────────────

describe("handleDeleteRelationsByArgId", () => {
  const argRels = () => [
    makeRel({ from: "J1", type: "jointly_entails", argumentId: "arg-1" }),
    makeRel({ from: "J2", type: "jointly_entails", argumentId: "arg-1" }),
    makeRel({ from: "J3", type: "supports", argumentId: "arg-1" }),
    makeRel({ from: "J4", type: "jointly_entails", argumentId: "arg-2" }),
  ];

  it("removes only the argument relations of that argument", () => {
    const { result } = renderHook(() =>
      useREActions(baseState({ relations: argRels() })),
    );
    act(() => result.current.handleDeleteRelationsByArgId("arg-1"));
    expect(result.current.state.relations.map((r) => r.from)).toEqual([
      // The `supports` relation shares the id but is not part of the argument.
      "J3",
      "J4",
    ]);
  });

  it("clears the selection when the deleted argument was selected", () => {
    const { result } = renderHook(() =>
      useREActions(baseState({ relations: argRels() })),
    );
    act(() => result.current.handleSelectRel(result.current.state.relations[0]));
    expect(result.current.selectedRel).not.toBeNull();
    act(() => result.current.handleDeleteRelationsByArgId("arg-1"));
    expect(result.current.selectedRel).toBeNull();
  });

  it("does not bump the round — deletion is not a revision", () => {
    const { result } = renderHook(() =>
      useREActions(baseState({ relations: argRels() })),
    );
    act(() => result.current.handleDeleteRelationsByArgId("arg-1"));
    expect(result.current.state.round).toBe(1);
  });
});

// ─── handleReinstateElement ───────────────────────────────────────────────────

describe("handleReinstateElement", () => {
  const withdrawn = () =>
    makeEl({ id: "J1", status: "withdrawn", withdrawnRound: 2, reason: "Too broad" });
  const rejected = () =>
    makeEl({ id: "J1", status: "rejected", rejectedRound: 2 });

  it("returns a withdrawn element to active and records the event", () => {
    const { result } = renderHook(() =>
      useREActions(baseState({ round: 4, elements: [withdrawn()] })),
    );
    act(() => result.current.handleReinstateElement("J1"));
    const el = result.current.state.elements[0];
    expect(el.status).toBe("active");
    // The legacy round is migrated into the list, so history is kept.
    expect(el.history).toEqual([
      { round: 2, type: "withdrawn", reason: "Too broad" },
      { round: 5, type: "reinstated" },
    ]);
  });

  it("returns a rejected element to active, keeping the rejection in history", () => {
    const { result } = renderHook(() =>
      useREActions(baseState({ round: 4, elements: [rejected()] })),
    );
    act(() => result.current.handleReinstateElement("J1"));
    const el = result.current.state.elements[0];
    expect(el.status).toBe("active");
    expect(el.history).toEqual([
      { round: 2, type: "rejected" },
      { round: 5, type: "reinstated" },
    ]);
  });

  it("increments the round and logs the decision", () => {
    const { result } = renderHook(() =>
      useREActions(baseState({ round: 4, elements: [withdrawn()] })),
    );
    act(() => result.current.handleReinstateElement("J1"));
    expect(result.current.state.round).toBe(5);
    expect(result.current.state.log.at(-1).decision).toBe("Reinstated");
  });

  it("ignores elements that are already in play", () => {
    const { result } = renderHook(() => useREActions(baseState({ round: 4 })));
    act(() => result.current.handleReinstateElement("J1"));
    expect(result.current.state.round).toBe(4);
    expect(result.current.state.log).toHaveLength(0);
  });

  it("ignores an unknown id", () => {
    const { result } = renderHook(() => useREActions(baseState({ round: 4 })));
    act(() => result.current.handleReinstateElement("J99"));
    expect(result.current.state.round).toBe(4);
  });

  it("records every withdraw/reinstate cycle", () => {
    const { result } = renderHook(() =>
      useREActions(baseState({ round: 4, elements: [withdrawn()] })),
    );
    act(() => result.current.handleReinstateElement("J1"));
    act(() => result.current.handleWithdrawConfirm("J1", "changed my mind"));
    act(() => result.current.handleReinstateElement("J1"));
    const el = result.current.state.elements[0];
    expect(el.status).toBe("active");
    expect(el.history.map((h) => [h.round, h.type])).toEqual([
      [2, "withdrawn"],
      [5, "reinstated"],
      [6, "withdrawn"],
      [7, "reinstated"],
    ]);
  });

  it("does not reopen a closed period when reinstated twice", () => {
    const { result } = renderHook(() =>
      useREActions(baseState({ round: 4, elements: [withdrawn()] })),
    );
    act(() => result.current.handleReinstateElement("J1"));
    const after = result.current.state.elements[0].history;
    act(() => result.current.handleReinstateElement("J1"));
    expect(result.current.state.elements[0].history).toEqual(after);
  });
});

// ─── handleWithdrawConfirm ────────────────────────────────────────────────────

describe("handleWithdrawConfirm", () => {
  it("sets element status to 'withdrawn' with an event and reason", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleWithdrawConfirm("J1", "No longer relevant"));
    const el = result.current.state.elements[0];
    expect(el.status).toBe("withdrawn");
    expect(el.history).toEqual([{ round: 2, type: "withdrawn", reason: "No longer relevant" }]);
    expect(el.reason).toBe("No longer relevant");
  });

  it("defaults reason to empty string when undefined", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleWithdrawConfirm("J1", undefined));
    expect(result.current.state.elements[0].reason).toBe("");
  });

  it("clears previousText and revisedRound from the withdrawn element", () => {
    const elRevised = makeEl({ previousText: "old text", revisedRound: 1 });
    const { result } = renderHook(() => useREActions(baseState({ elements: [elRevised] })));
    act(() => result.current.handleWithdrawConfirm("J1", "done"));
    const el = result.current.state.elements[0];
    expect(el.previousText).toBeUndefined();
    expect(el.revisedRound).toBeUndefined();
  });

  it("increments state.round and appends a log entry with decision 'Withdrawn'", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleWithdrawConfirm("J1", "reason"));
    expect(result.current.state.round).toBe(2);
    expect(result.current.state.log).toHaveLength(1);
    expect(result.current.state.log[0].decision).toBe("Withdrawn");
  });

  it("clears withdrawingId after confirm", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleWithdrawRequest("J1"));
    expect(result.current.withdrawingId).toBe("J1");
    act(() => result.current.handleWithdrawConfirm("J1", "reason"));
    expect(result.current.withdrawingId).toBeNull();
  });

  it("clears selected when the withdrawn element was selected", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleSelectNode("J1"));
    act(() => result.current.handleWithdrawConfirm("J1", "reason"));
    expect(result.current.selected).toBeNull();
  });

  it("does not clear selected when a different element is selected", () => {
    const state = baseState({ elements: [makeEl({ id: "J1" }), makeEl({ id: "J2" })] });
    const { result } = renderHook(() => useREActions(state));
    act(() => result.current.handleSelectNode("J2"));
    act(() => result.current.handleWithdrawConfirm("J1", "reason"));
    expect(result.current.selected).toBe("J2");
  });
});

// ─── handleReinstateRelation ──────────────────────────────────────────────────

describe("handleReinstateRelation", () => {
  it("returns a withdrawn relation to active and records the event", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleWithdrawRelRequest(result.current.state.relations[0]));
    act(() => result.current.handleReinstateRelation(result.current.state.relations[0]));
    const rel = result.current.state.relations[0];
    expect(rel.status).toBe("active");
    expect(rel.history).toEqual([
      { round: 2, type: "withdrawn" },
      { round: 3, type: "reinstated" },
    ]);
  });

  it("ignores a relation that is not withdrawn", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleReinstateRelation(result.current.state.relations[0]));
    expect(result.current.state.round).toBe(1);
    expect(result.current.state.log).toHaveLength(0);
  });

  it("reinstates every relation of an argument together", () => {
    const argRels = [
      makeRel({ from: "J1", to: "P1", type: "jointly_entails", argumentId: "arg-1" }),
      makeRel({ from: "J2", to: "P1", type: "jointly_entails", argumentId: "arg-1" }),
    ];
    const { result } = renderHook(() =>
      useREActions(baseState({ relations: argRels })),
    );
    act(() => result.current.handleWithdrawRelRequest(result.current.state.relations[0]));
    expect(result.current.state.relations.every((r) => r.status === "withdrawn")).toBe(true);

    act(() => result.current.handleReinstateRelation(result.current.state.relations[0]));
    expect(result.current.state.relations.every((r) => r.status === "active")).toBe(true);
    for (const r of result.current.state.relations) {
      expect(r.history).toEqual([
        { round: 2, type: "withdrawn" },
        { round: 3, type: "reinstated" },
      ]);
    }
  });

  it("logs the decision", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleWithdrawRelRequest(result.current.state.relations[0]));
    act(() => result.current.handleReinstateRelation(result.current.state.relations[0]));
    expect(result.current.state.log.at(-1).decision).toBe("Reinstated");
  });
});

// ─── handleWithdrawRelRequest ─────────────────────────────────────────────────

describe("handleWithdrawRelRequest", () => {
  it("sets relation status to 'withdrawn' and records the event", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    const rel = result.current.state.relations[0];
    act(() => result.current.handleWithdrawRelRequest(rel));
    const updated = result.current.state.relations[0];
    expect(updated.status).toBe("withdrawn");
    expect(updated.history).toEqual([{ round: 2, type: "withdrawn" }]);
  });

  it("increments state.round and appends a log entry with decision 'Withdrawn'", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    const rel = result.current.state.relations[0];
    act(() => result.current.handleWithdrawRelRequest(rel));
    expect(result.current.state.round).toBe(2);
    expect(result.current.state.log[0].decision).toBe("Withdrawn");
  });

  it("clears selectedRel when the withdrawn relation was selected", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    const rel = result.current.state.relations[0];
    act(() => result.current.handleSelectRel(rel));
    act(() => result.current.handleWithdrawRelRequest(rel));
    expect(result.current.selectedRel).toBeNull();
  });

  it("does not clear selectedRel when a different relation is selected", () => {
    const rel1 = makeRel({ from: "J1", to: "P1" });
    const rel2 = makeRel({ from: "P1", to: "J1", type: "depends" });
    const state = baseState({ relations: [rel1, rel2] });
    const { result } = renderHook(() => useREActions(state));
    act(() => result.current.handleSelectRel(result.current.state.relations[1]));
    act(() => result.current.handleWithdrawRelRequest(result.current.state.relations[0]));
    expect(result.current.selectedRel).not.toBeNull();
  });
});

// ─── handleRejectElements ─────────────────────────────────────────────────────

describe("handleRejectElements", () => {
  it("appends rejected elements with correct status and rejectedRound", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleRejectElements([
        { type: "judgment", text: "Rejected J", confidence: 0.33, origin: "assistant" },
      ]);
    });
    const el = result.current.state.elements[1];
    expect(el.status).toBe("rejected");
    expect(el.rejectedRound).toBe(1);
    expect(el.addedRound).toBe(1);
  });

  it("does not increment state.round", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleRejectElements([{ type: "judgment", text: "x", confidence: 0.33, origin: "assistant" }]);
    });
    expect(result.current.state.round).toBe(1);
  });

  it("assigns sequential IDs within the same type in one batch", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleRejectElements([
        { type: "judgment", text: "A", confidence: 0.33, origin: "assistant" },
        { type: "judgment", text: "B", confidence: 0.33, origin: "assistant" },
      ]);
    });
    const els = result.current.state.elements;
    expect(els[1].id).toBe("J2");
    expect(els[2].id).toBe("J3");
  });

  it("assigns IDs independently per type in one batch", () => {
    const state = baseState({ elements: [makeEl({ id: "J1" }), makeEl({ id: "P1", type: "principle" })] });
    const { result } = renderHook(() => useREActions(state));
    act(() => {
      result.current.handleRejectElements([
        { type: "judgment", text: "x", confidence: 0.33, origin: "assistant" },
        { type: "principle", text: "y", confidence: 0.33, origin: "assistant" },
      ]);
    });
    const els = result.current.state.elements;
    expect(els[2].id).toBe("J2");
    expect(els[3].id).toBe("P2");
  });

  it("uses singular in log for one rejection", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleRejectElements([{ type: "judgment", text: "a", confidence: 0.33, origin: "assistant" }]);
    });
    expect(result.current.state.log[0].findings).toContain("1 suggestion rejected");
  });

  it("uses plural in log for multiple rejections", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleRejectElements([
        { type: "judgment", text: "a", confidence: 0.33, origin: "assistant" },
        { type: "judgment", text: "b", confidence: 0.33, origin: "assistant" },
      ]);
    });
    expect(result.current.state.log[0].findings).toContain("2 suggestions rejected");
  });
});

// ─── handleRejectRelations ────────────────────────────────────────────────────

describe("handleRejectRelations", () => {
  it("appends rejected relations with status and rejectedRound", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleRejectRelations([{ from: "J1", to: "P1", type: "conflicts", explanation: "x" }]);
    });
    const rel = result.current.state.relations[1];
    expect(rel.status).toBe("rejected");
    expect(rel.rejectedRound).toBe(1);
  });

  it("does not increment state.round", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleRejectRelations([{ from: "J1", to: "P1", type: "conflicts", explanation: "x" }]);
    });
    expect(result.current.state.round).toBe(1);
  });

  it("uses correct singular/plural in log entry", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleRejectRelations([
        { from: "J1", to: "P1", type: "conflicts", explanation: "x" },
        { from: "P1", to: "J1", type: "depends", explanation: "y" },
      ]);
    });
    expect(result.current.state.log[0].findings).toContain("2 relation suggestions rejected");
    const { result: result2 } = renderHook(() => useREActions(baseState()));
    act(() => {
      result2.current.handleRejectRelations([{ from: "J1", to: "P1", type: "conflicts", explanation: "x" }]);
    });
    expect(result2.current.state.log[0].findings).toContain("1 relation suggestion rejected");
  });
});

// ─── handleUndo / canUndo ─────────────────────────────────────────────────────

describe("handleUndo / canUndo", () => {
  it("canUndo is false initially", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    expect(result.current.canUndo).toBe(false);
  });

  it("canUndo is true after a mutation", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: 1.0, origin: "user" });
    });
    expect(result.current.canUndo).toBe(true);
  });

  it("reverts state to before the last mutation", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: 1.0, origin: "user" });
    });
    expect(result.current.state.elements).toHaveLength(2);
    act(() => result.current.handleUndo());
    expect(result.current.state.elements).toHaveLength(1);
    expect(result.current.state.round).toBe(1);
  });

  it("supports multiple sequential undos", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "A", confidence: 1.0, origin: "user" });
    });
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "B", confidence: 1.0, origin: "user" });
    });
    expect(result.current.state.elements).toHaveLength(2);
    act(() => result.current.handleUndo());
    expect(result.current.state.elements).toHaveLength(1);
    act(() => result.current.handleUndo());
    expect(result.current.state.elements).toHaveLength(0);
  });

  it("canUndo is false after undoing all mutations", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: 1.0, origin: "user" });
    });
    act(() => result.current.handleUndo());
    expect(result.current.canUndo).toBe(false);
  });

  it("does nothing when the undo stack is empty", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleUndo());
    expect(result.current.state.elements).toHaveLength(1);
  });

  it("clears selected when the selected element no longer exists after undo", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: 1.0, origin: "user" });
    });
    act(() => result.current.handleSelectNode("J1"));
    expect(result.current.selected).toBe("J1");
    act(() => result.current.handleUndo());
    expect(result.current.selected).toBeNull();
  });

  it("drops oldest states once stack reaches MAX_UNDO (20)", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    // 21 mutations: the state before mutation 1 (0 elements) will be dropped
    act(() => {
      for (let i = 0; i < 21; i++) {
        result.current.handleAddElement({ type: "judgment", text: `x${i}`, confidence: 1.0, origin: "user" });
      }
    });
    expect(result.current.state.elements).toHaveLength(21);
    // Undo 20 times — reaches state after mutation 1, not state before mutation 1
    for (let i = 0; i < 20; i++) {
      act(() => result.current.handleUndo());
    }
    expect(result.current.state.elements).toHaveLength(1);
    // 21st undo is a no-op (stack is empty)
    act(() => result.current.handleUndo());
    expect(result.current.state.elements).toHaveLength(1);
  });
});

// ─── handleRedo / canRedo ────────────────────────────────────────────────────

describe("handleRedo / canRedo", () => {
  const addEl = (result, text) =>
    act(() =>
      result.current.handleAddElement({
        type: "judgment",
        text,
        confidence: 1.0,
        origin: "user",
      }),
    );

  it("canRedo is false until something has been undone", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    expect(result.current.canRedo).toBe(false);
    addEl(result, "a");
    expect(result.current.canRedo).toBe(false);
  });

  it("canRedo is true after an undo", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    addEl(result, "a");
    act(() => result.current.handleUndo());
    expect(result.current.canRedo).toBe(true);
  });

  it("restores the state the undo took away", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    addEl(result, "a");
    act(() => result.current.handleUndo());
    expect(result.current.state.elements).toHaveLength(0);
    act(() => result.current.handleRedo());
    expect(result.current.state.elements).toHaveLength(1);
    expect(result.current.state.elements[0].text).toBe("a");
  });

  it("walks back and forth over several edits", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    addEl(result, "a");
    addEl(result, "b");
    addEl(result, "c");

    act(() => result.current.handleUndo());
    act(() => result.current.handleUndo());
    expect(result.current.state.elements).toHaveLength(1);

    act(() => result.current.handleRedo());
    act(() => result.current.handleRedo());
    expect(result.current.state.elements).toHaveLength(3);
    expect(result.current.canRedo).toBe(false);
  });

  it("does nothing when there is nothing to redo", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    addEl(result, "a");
    act(() => result.current.handleRedo());
    expect(result.current.state.elements).toHaveLength(1);
  });

  it("a new edit abandons the redo branch", () => {
    // The undone states describe a future that no longer follows from here.
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    addEl(result, "a");
    addEl(result, "b");
    act(() => result.current.handleUndo());
    expect(result.current.canRedo).toBe(true);

    addEl(result, "c");
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.handleRedo());
    expect(result.current.state.elements.map((e) => e.text)).toEqual(["a", "c"]);
  });

  it("redo is still available after an undo that followed a redo", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    addEl(result, "a");
    act(() => result.current.handleUndo());
    act(() => result.current.handleRedo());
    act(() => result.current.handleUndo());
    expect(result.current.canRedo).toBe(true);
    expect(result.current.state.elements).toHaveLength(0);
  });

  it("importing a file clears both directions", () => {
    // A new process is not a step in this one.
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    addEl(result, "a");
    act(() => result.current.handleUndo());
    expect(result.current.canRedo).toBe(true);

    importStateFromFile.mockResolvedValue(baseState({ elements: [] }));
    return act(() => result.current.handleImportFile(new Blob())).then(() => {
      expect(result.current.canRedo).toBe(false);
      expect(result.current.canUndo).toBe(false);
    });
  });

  it("clears a selection the redone state does not contain", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    addEl(result, "a");
    act(() => result.current.handleUndo());
    act(() => result.current.handleSelectNode("J1"));
    // J1 exists again after the redo, so the selection should survive it.
    act(() => result.current.handleRedo());
    expect(result.current.selected).toBe("J1");
  });

  it("works under StrictMode", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })), {
      wrapper: StrictMode,
    });
    addEl(result, "a");
    addEl(result, "b");
    act(() => result.current.handleUndo());
    act(() => result.current.handleUndo());
    act(() => result.current.handleRedo());
    act(() => result.current.handleRedo());
    expect(result.current.state.elements).toHaveLength(2);
  });
});

// ─── handleUndo under updater re-invocation ──────────────────────────────────

// main.jsx renders the app inside StrictMode, which deliberately runs state
// updaters twice; concurrent React may also re-run one when it discards an
// in-progress render. Anything the update does besides computing the next state
// therefore happens more often than the edit did. The undo stack used to be a
// ref pushed to from inside the updater, so each edit recorded two entries while
// the counter recorded one, and an edit could survive being undone.
//
// The rest of this file renders without a wrapper, which is exactly the
// condition under which that bug is invisible — hence a StrictMode pass here.
describe("handleUndo / canUndo under StrictMode", () => {
  const addN = (result, n) => {
    for (let i = 0; i < n; i++) {
      act(() =>
        result.current.handleAddElement({
          type: "judgment",
          text: `x${i}`,
          confidence: 1.0,
          origin: "user",
        }),
      );
    }
  };

  it("records one undo step per edit, not one per updater call", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })), {
      wrapper: StrictMode,
    });
    addN(result, 3);
    expect(result.current.state.elements).toHaveLength(3);

    act(() => result.current.handleUndo());
    act(() => result.current.handleUndo());
    act(() => result.current.handleUndo());

    expect(result.current.state.elements).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);
  });

  it("still reverts exactly one edit per undo", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })), {
      wrapper: StrictMode,
    });
    addN(result, 2);
    act(() => result.current.handleUndo());
    expect(result.current.state.elements).toHaveLength(1);
  });

  it("still caps the stack at MAX_UNDO (20)", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })), {
      wrapper: StrictMode,
    });
    addN(result, 21);
    for (let i = 0; i < 20; i++) act(() => result.current.handleUndo());
    expect(result.current.state.elements).toHaveLength(1);
    act(() => result.current.handleUndo());
    expect(result.current.state.elements).toHaveLength(1);
  });
});

// ─── handleSelectNode / handleSelectRel ──────────────────────────────────────

describe("handleSelectNode", () => {
  it("sets selected and clears recentlyAdded", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: 1.0, origin: "user" });
    });
    expect(result.current.recentlyAdded).toBe("J2");
    act(() => result.current.handleSelectNode("J1"));
    expect(result.current.selected).toBe("J1");
    expect(result.current.recentlyAdded).toBeNull();
  });

  it("clears selectedRel", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    const rel = result.current.state.relations[0];
    act(() => result.current.handleSelectRel(rel));
    expect(result.current.selectedRel).toBe(rel);
    act(() => result.current.handleSelectNode("J1"));
    expect(result.current.selectedRel).toBeNull();
  });

  it("clears recentlyAddedRel", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddRelation({ from: "J1", to: "P1", type: "conflicts", explanation: "" });
    });
    expect(result.current.recentlyAddedRel).not.toBeNull();
    act(() => result.current.handleSelectNode("J1"));
    expect(result.current.recentlyAddedRel).toBeNull();
  });
});

describe("handleSelectRel", () => {
  it("sets selectedRel and clears selected", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleSelectNode("J1"));
    expect(result.current.selected).toBe("J1");
    const rel = result.current.state.relations[0];
    act(() => result.current.handleSelectRel(rel));
    expect(result.current.selectedRel).toBe(rel);
    expect(result.current.selected).toBeNull();
  });

  it("clears recentlyAdded", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: 1.0, origin: "user" });
    });
    expect(result.current.recentlyAdded).toBe("J2");
    const rel = result.current.state.relations[0];
    act(() => result.current.handleSelectRel(rel));
    expect(result.current.recentlyAdded).toBeNull();
  });

  it("clears recentlyAddedRel", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddRelation({ from: "J1", to: "P1", type: "conflicts", explanation: "" });
    });
    expect(result.current.recentlyAddedRel).not.toBeNull();
    const origRel = result.current.state.relations[0];
    act(() => result.current.handleSelectRel(origRel));
    expect(result.current.recentlyAddedRel).toBeNull();
  });
});

// ─── handleEditRequest ────────────────────────────────────────────────────────

describe("handleEditRequest", () => {
  it("sets editingEl to the matching element", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    expect(result.current.editingEl).toEqual(result.current.state.elements[0]);
  });

  it("leaves the selection alone", () => {
    // Selection follows the user's pointer only — a click on a node or a text
    // card. Revising is not a click on the element.
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    expect(result.current.selected).toBeNull();
  });

  it("does not deselect whatever the user had selected", () => {
    // `handleSelectNode` is the one path selection comes from — it is what
    // `onSelect` is wired to on both the graph and the text panel.
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleSelectNode("J1"));
    act(() => result.current.handleEditRequest("J1"));
    expect(result.current.selected).toBe("J1");
  });

  it("resets editingEl to null when element id is not found", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    expect(result.current.editingEl).not.toBeNull();
    act(() => result.current.handleEditRequest("X99"));
    expect(result.current.editingEl).toBeNull();
  });
});

// ─── handleImportFile ─────────────────────────────────────────────────────────

describe("handleImportFile", () => {
  it("replaces state with imported state and resets undo stack and selection", async () => {
    const imported = baseState({ topic: "Imported topic", elements: [] });
    importStateFromFile.mockResolvedValue(imported);
    const { result } = renderHook(() => useREActions(baseState()));
    // Populate undo stack, node selection, and relation selection
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: 1.0, origin: "user" });
    });
    act(() => result.current.handleSelectNode("J1"));
    expect(result.current.selected).toBe("J1");
    act(() => result.current.handleSelectRel(result.current.state.relations[0]));
    expect(result.current.selectedRel).not.toBeNull();
    expect(result.current.canUndo).toBe(true);
    await act(async () => {
      await result.current.handleImportFile(new File([], "test.md"));
    });
    expect(result.current.state.topic).toBe("Imported topic");
    expect(result.current.state.elements).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.selected).toBeNull();
    expect(result.current.selectedRel).toBeNull();
  });
});
