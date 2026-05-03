// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useREActions } from "./useREActions.js";

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
    confidence: "high",
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
        confidence: "moderate",
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
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: "high", origin: "user" });
    });
    expect(result.current.state.round).toBe(2);
  });

  it("appends a log entry with decision 'Added'", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: "high", origin: "user" });
    });
    expect(result.current.state.log).toHaveLength(1);
    expect(result.current.state.log[0].decision).toBe("Added");
    expect(result.current.state.log[0].round).toBe(2);
  });

  it("sets recentlyAdded to the new element id and clears recentlyAddedRel", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddElement({ type: "principle", text: "P", confidence: "high", origin: "user" });
    });
    expect(result.current.recentlyAdded).toBe("P1");
    expect(result.current.recentlyAddedRel).toBeNull();
  });

  it("clears selected and selectedRel", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleSelectNode("J1"));
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: "high", origin: "user" });
    });
    expect(result.current.selected).toBeNull();
    expect(result.current.selectedRel).toBeNull();
  });

  it("generates IDs independently per type", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    act(() => {
      result.current.handleAddElement({ type: "principle", text: "P", confidence: "high", origin: "user" });
    });
    expect(result.current.state.elements[0].id).toBe("P1");
    act(() => {
      result.current.handleAddElement({ type: "theory", text: "T", confidence: "high", origin: "user" });
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

  it("increments state.round and appends a log entry", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddRelation({ from: "J1", to: "P1", type: "supports", explanation: "" });
    });
    expect(result.current.state.round).toBe(2);
    expect(result.current.state.log).toHaveLength(1);
    expect(result.current.state.log[0].decision).toBe("Added");
  });

  it("sets recentlyAddedRel when select=true (default) and clears selected/recentlyAdded", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleSelectNode("J1"));
    act(() => {
      result.current.handleAddRelation({ from: "J1", to: "P1", type: "supports", explanation: "" });
    });
    expect(result.current.recentlyAddedRel).toMatchObject({ from: "J1", to: "P1", type: "supports", addedRound: 2 });
    expect(result.current.selected).toBeNull();
    expect(result.current.recentlyAdded).toBeNull();
  });

  it("does not set recentlyAddedRel when select=false", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddRelation(
        { from: "J1", to: "P1", type: "supports", explanation: "" },
        { select: false },
      );
    });
    expect(result.current.recentlyAddedRel).toBeNull();
  });
});

// ─── handleEditSave ───────────────────────────────────────────────────────────

describe("handleEditSave", () => {
  it("updates element text and sets status to 'revised'", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    act(() => {
      result.current.handleEditSave({ text: "Updated text", confidence: "high", type: "judgment", origin: "user" });
    });
    const el = result.current.state.elements[0];
    expect(el.text).toBe("Updated text");
    expect(el.status).toBe("revised");
  });

  it("stores original text in previousText and sets revisedRound", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    act(() => {
      result.current.handleEditSave({ text: "New text", confidence: "high", type: "judgment", origin: "user" });
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
      result.current.handleEditSave({ text: "New text", confidence: "high", type: "judgment", origin: "user" });
    });
    const el = result.current.state.elements[0];
    expect(el.withdrawnRound).toBeUndefined();
    expect(el.reason).toBeUndefined();
  });

  it("increments state.round", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    act(() => {
      result.current.handleEditSave({ text: "x", confidence: "high", type: "judgment", origin: "user" });
    });
    expect(result.current.state.round).toBe(2);
  });

  it("appends log entry with diff string when fields changed", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    act(() => {
      result.current.handleEditSave({ text: "New text", confidence: "low", type: "judgment", origin: "user" });
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
        confidence: "high",
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
      result.current.handleEditSave({ text: "x", confidence: "high", type: "judgment", origin: "user" });
    });
    expect(result.current.editingEl).toBeNull();
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

// ─── handleWithdrawConfirm ────────────────────────────────────────────────────

describe("handleWithdrawConfirm", () => {
  it("sets element status to 'withdrawn' with withdrawnRound and reason", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleWithdrawConfirm("J1", "No longer relevant"));
    const el = result.current.state.elements[0];
    expect(el.status).toBe("withdrawn");
    expect(el.withdrawnRound).toBe(2);
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

// ─── handleWithdrawRelRequest ─────────────────────────────────────────────────

describe("handleWithdrawRelRequest", () => {
  it("sets relation status to 'withdrawn' with withdrawnRound", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    const rel = result.current.state.relations[0];
    act(() => result.current.handleWithdrawRelRequest(rel));
    const updated = result.current.state.relations[0];
    expect(updated.status).toBe("withdrawn");
    expect(updated.withdrawnRound).toBe(2);
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
        { type: "judgment", text: "Rejected J", confidence: "low", origin: "assistant" },
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
      result.current.handleRejectElements([{ type: "judgment", text: "x", confidence: "low", origin: "assistant" }]);
    });
    expect(result.current.state.round).toBe(1);
  });

  it("assigns sequential IDs within the same type in one batch", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleRejectElements([
        { type: "judgment", text: "A", confidence: "low", origin: "assistant" },
        { type: "judgment", text: "B", confidence: "low", origin: "assistant" },
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
        { type: "judgment", text: "x", confidence: "low", origin: "assistant" },
        { type: "principle", text: "y", confidence: "low", origin: "assistant" },
      ]);
    });
    const els = result.current.state.elements;
    expect(els[2].id).toBe("J2");
    expect(els[3].id).toBe("P2");
  });

  it("uses singular in log for one rejection", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleRejectElements([{ type: "judgment", text: "a", confidence: "low", origin: "assistant" }]);
    });
    expect(result.current.state.log[0].findings).toContain("1 suggestion rejected");
  });

  it("uses plural in log for multiple rejections", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleRejectElements([
        { type: "judgment", text: "a", confidence: "low", origin: "assistant" },
        { type: "judgment", text: "b", confidence: "low", origin: "assistant" },
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
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: "high", origin: "user" });
    });
    expect(result.current.canUndo).toBe(true);
  });

  it("reverts state to before the last mutation", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: "high", origin: "user" });
    });
    expect(result.current.state.elements).toHaveLength(2);
    act(() => result.current.handleUndo());
    expect(result.current.state.elements).toHaveLength(1);
    expect(result.current.state.round).toBe(1);
  });

  it("supports multiple sequential undos", () => {
    const { result } = renderHook(() => useREActions(baseState({ elements: [] })));
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "A", confidence: "high", origin: "user" });
    });
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "B", confidence: "high", origin: "user" });
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
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: "high", origin: "user" });
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
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: "high", origin: "user" });
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
        result.current.handleAddElement({ type: "judgment", text: `x${i}`, confidence: "high", origin: "user" });
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

// ─── handleSelectNode / handleSelectRel ──────────────────────────────────────

describe("handleSelectNode", () => {
  it("sets selected and clears selectedRel, recentlyAdded, recentlyAddedRel", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    // Populate recentlyAdded first
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: "high", origin: "user" });
    });
    expect(result.current.recentlyAdded).toBe("J2");
    act(() => result.current.handleSelectNode("J1"));
    expect(result.current.selected).toBe("J1");
    expect(result.current.selectedRel).toBeNull();
    expect(result.current.recentlyAdded).toBeNull();
    expect(result.current.recentlyAddedRel).toBeNull();
  });
});

describe("handleSelectRel", () => {
  it("sets selectedRel and clears selected, recentlyAdded, recentlyAddedRel", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleSelectNode("J1"));
    const rel = result.current.state.relations[0];
    act(() => result.current.handleSelectRel(rel));
    expect(result.current.selectedRel).toBe(rel);
    expect(result.current.selected).toBeNull();
    expect(result.current.recentlyAdded).toBeNull();
    expect(result.current.recentlyAddedRel).toBeNull();
  });
});

// ─── handleEditRequest ────────────────────────────────────────────────────────

describe("handleEditRequest", () => {
  it("sets selected and editingEl to the matching element", () => {
    const { result } = renderHook(() => useREActions(baseState()));
    act(() => result.current.handleEditRequest("J1"));
    expect(result.current.selected).toBe("J1");
    expect(result.current.editingEl).toEqual(result.current.state.elements[0]);
  });

  it("sets editingEl to null when element id is not found", () => {
    const { result } = renderHook(() => useREActions(baseState()));
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
    // Populate undo stack and selection
    act(() => {
      result.current.handleAddElement({ type: "judgment", text: "x", confidence: "high", origin: "user" });
    });
    act(() => result.current.handleSelectNode("J1"));
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
