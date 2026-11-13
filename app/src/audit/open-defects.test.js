// @vitest-environment jsdom
/**
 * @fileoverview Defects found in the audit of 2026-11-13 (plans/audit-2026-11-13.md),
 * each asserted to be *still there* — the convention of e2e/known-issues.spec.js.
 *
 * Green while a defect is open, red the moment it is fixed: the failure then
 * names the entry, and the fix is to turn the assertion round (the comment on
 * each says into what) and move the test beside the code it covers. Nothing
 * here is skipped or expected to fail, so a run that measured nothing cannot
 * pass for one that found the defect gone.
 *
 * The ids (L1, L2, …) are the audit's.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useREActions } from "../hooks/useREActions.js";
import { makeEmptyState } from "../state.js";
import { checkRelation } from "../components/user_edits/addPanelShared.js";
import { computeCoherence } from "../utils/coherence.js";
import { loadDraft, saveDraft } from "../utils/draftStorage.js";
import { buildArgdown } from "../utils/exportArgdown.js";
import { buildMarkdown } from "../utils/exportMarkdown.js";
import { validateState } from "../utils/importMarkdown.js";
import { mergeStates } from "../utils/mergeStates.js";
import { asOfRound, isWithdrawnNow } from "../utils/stateUtils.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const el = (id, type, extra = {}) => ({
  id,
  type,
  status: "active",
  confidence: 0.67,
  origin: "user",
  text: `Text of ${id}.`,
  addedRound: 1,
  ...extra,
});

const rel = (from, to, type, extra = {}) => ({
  from,
  to,
  type,
  explanation: "",
  addedRound: 1,
  ...extra,
});

const state = (elements, relations = [], extra = {}) => ({
  topic: "Audit",
  phase: 1,
  round: 5,
  elements,
  relations,
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
  ...extra,
});

const open = (id) => `${id} is fixed, or the path to it moved`;

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

// ─── L1 · A long statement makes the process unreadable to the app itself ─────

describe("L1 — wording the app accepts and its own validator refuses", () => {
  // No field in the app caps what is typed. `validateState` caps every string
  // (log text at 5 000, an explanation or a reason at 2 000, a topic at 500),
  // and the autosaved draft and every exported file are read back through it.
  const long = (c) => c.repeat(2_600);

  it("revising a 2 600-character statement writes a log entry Import refuses", () => {
    const start = state([el("J1", "judgment", { text: long("a") })], [], {
      round: 1,
    });
    const { result } = renderHook(() => useREActions(start));
    act(() => result.current.handleEditRequest("J1"));
    act(() =>
      result.current.handleEditSave({
        type: "judgment",
        confidence: 0.67,
        origin: "user",
        text: long("b"),
      }),
    );
    const after = result.current.state;
    expect(after.elements[0].text).toBe(long("b"));

    // Fixed when this reads `.not.toThrow()`.
    expect(
      () => validateState(JSON.parse(JSON.stringify(after))),
      open("L1"),
    ).toThrow(/exceeds 5000 characters/);
  });

  it("and the autosaved draft of that process is deleted on the next visit", () => {
    const entry = `J1 — text: ${long("a")} → ${long("b")}`;
    const draft = state([el("J1", "judgment", { text: long("b") })], [], {
      log: [{ round: 2, findings: "", options: "", decision: "", changes: entry }],
    });
    expect(saveDraft(draft)).toBe(true);
    expect(localStorage.getItem("reDraft")).not.toBeNull();

    // Fixed when the draft comes back and stays stored.
    expect(loadDraft(), open("L1")).toBeNull();
    expect(localStorage.getItem("reDraft"), open("L1")).toBeNull();
  });

  it("a 2 001-character explanation does the same", () => {
    const s = state(
      [el("J1", "judgment"), el("P1", "principle")],
      [rel("J1", "P1", "supports", { explanation: "e".repeat(2_001) })],
    );
    expect(() => validateState(s), open("L1")).toThrow(/exceeds 2000/);
  });
});

// ─── L2 · A rejected suggestion before the first step ─────────────────────────

describe("L2 — rejecting a suggestion takes no step", () => {
  it("in a new process it is stamped step 0, which the backend refuses (ge=1)", () => {
    const { result } = renderHook(() => useREActions(makeEmptyState("Topic")));
    act(() =>
      result.current.handleRejectElements([
        { type: "judgment", text: "A suggestion.", confidence: 0.67, origin: "llm" },
      ]),
    );
    const { round, elements, log } = result.current.state;
    // Fixed when a rejection is a step like any other change (CLAUDE.md,
    // "Steps and rounds"), or is not recorded as an element at all:
    // backend/models/re_state.py has `added_round`, `rejected_round` and a log
    // entry's `round` at ge=1 — see backend/tests/test_open_defects.py.
    expect(round, open("L2")).toBe(0);
    expect(elements[0].addedRound, open("L2")).toBe(0);
    expect(elements[0].history[0].round, open("L2")).toBe(0);
    expect(log[0].round, open("L2")).toBe(0);
  });
});

// ─── L3 · Status and history disagree ─────────────────────────────────────────

describe("L3 — a revised rejected element is held now and rejected in playback", () => {
  it("Revise on a rejected card leaves no reinstatement in its history", () => {
    const rejected = el("J1", "judgment", {
      status: "rejected",
      history: [{ round: 2, type: "rejected" }],
    });
    const { result } = renderHook(() => useREActions(state([rejected])));
    act(() => result.current.handleEditRequest("J1"));
    act(() =>
      result.current.handleEditSave({
        type: "judgment",
        confidence: 0.67,
        origin: "user",
        text: "Reworded.",
      }),
    );
    const now = result.current.state.elements[0];
    expect(now.status).toBe("revised");
    // Fixed when both read "revised": the fold is what History, the per-step
    // scores (status_at_step in rethon_scoring.py) and playback go by.
    expect(asOfRound(now, result.current.state.round).status, open("L3")).toBe(
      "rejected",
    );
  });
});

// ─── L4 · What Import and Merge let through ───────────────────────────────────

describe("L4 — validateState checks fields, not the graph they make", () => {
  it("accepts two elements with one id, a relation to nothing, and a loop", () => {
    const s = state(
      [el("J1", "judgment"), el("J1", "judgment", { text: "Another." })],
      [
        rel("J1", "J9", "supports"),
        rel("J1", "J1", "conflicts"),
        // A joint premise with no argumentId: rethon_arguments leaves it out.
        rel("J1", "J1", "jointly_entails"),
      ],
    );
    let out;
    // Fixed when this throws, or returns the state without them.
    expect(() => (out = validateState(s)), open("L4")).not.toThrow();
    expect(out.elements, open("L4")).toHaveLength(2);
    expect(out.relations, open("L4")).toHaveLength(3);
  });

  it("drops reinstatedRound, so an older file's reinstated element reads as withdrawn", () => {
    // `legacyHistory` in stateUtils reads `reinstatedRound`; the validator
    // every file passes through first does not whitelist it.
    const s = state([
      el("J1", "judgment", { withdrawnRound: 2, reinstatedRound: 4 }),
    ]);
    const [j1] = validateState(s).elements;
    expect(j1.status).toBe("active");
    // Fixed when this is false.
    expect(isWithdrawnNow(j1), open("L4")).toBe(true);
  });
});

// ─── L5 · The same relation twice ─────────────────────────────────────────────

describe("L5 — a relation already held can be added again", () => {
  it("as a second step, a second edge and a second log entry", () => {
    const start = state(
      [el("J1", "judgment"), el("P1", "principle")],
      [rel("J1", "P1", "supports")],
    );
    const { result } = renderHook(() => useREActions(start));
    act(() =>
      result.current.handleAddRelation({
        from: "J1",
        to: "P1",
        type: "supports",
        explanation: "",
      }),
    );
    // Fixed when the count stays 1 and the step does not advance.
    expect(result.current.state.relations, open("L5")).toHaveLength(2);
    expect(result.current.state.round, open("L5")).toBe(6);
  });
});

// ─── L6 · What the reader is never shown ──────────────────────────────────────

describe("L6 — a log entry's findings appear in no readable part of the export", () => {
  it("the Markdown log prints `changes` alone", () => {
    const note = "1 undercut (_>) left out: an attack on an inference has no counterpart here.";
    const s = state([el("J1", "judgment")], [], {
      round: 1,
      log: [
        {
          round: 1,
          findings: `Imported from Argdown. ${note}`,
          options: "",
          decision: "Imported",
          changes: "Read in loose mode (the default). Added 1 element and 0 relations.",
        },
      ],
    });
    const md = buildMarkdown(s, {}, new Set(["elements", "relations", "log"]));
    expect(md).toContain("Read in loose mode");
    // Fixed when this is `.toContain(note)`. The panel's Log section and
    // History's log box read `changes` alone too (LogSection, LogOverlay).
    expect(md, open("L6")).not.toContain(note);
  });
});

// ─── L7 · Merge ───────────────────────────────────────────────────────────────

describe("L7 — a process merge and arguments", () => {
  const current = state([el("J1", "judgment", { text: "Same claim." })]);

  it("two premises fused into one element arrive as a joint argument of one premise, twice", () => {
    const incoming = state(
      [
        el("J1", "judgment", { text: "Same claim." }),
        el("J2", "judgment", { text: "Same  claim. " }),
        el("P1", "principle"),
      ],
      [
        rel("J1", "P1", "jointly_entails", { argumentId: "a" }),
        rel("J2", "P1", "jointly_entails", { argumentId: "a" }),
      ],
    );
    const links = mergeStates(current, incoming).relations;
    // Fixed when there is one link, typed `entails` — what `mergeElementPair`
    // does for the same case ("an argument that loses a premise is retyped").
    expect(links.map((r) => `${r.from} ${r.type} ${r.to}`), open("L7")).toEqual([
      "J1 jointly_entails P1",
      "J1 jointly_entails P1",
    ]);
  });

  it("brings in the links a revision had replaced", () => {
    const incoming = state(
      [el("J5", "judgment", { text: "Other." }), el("P1", "principle")],
      [
        rel("J5", "P1", "entails", {
          argumentId: "old",
          status: "withdrawn",
          supersededBy: "new",
          history: [{ round: 3, type: "withdrawn" }],
        }),
      ],
    );
    const merged = mergeStates(current, incoming);
    // Fixed when this is empty: a superseded link "is the record, not the
    // position", and the incoming record is not replayed.
    expect(merged.relations.filter((r) => r.supersededBy), open("L7")).toHaveLength(1);
    expect(merged.log.at(-1).changes, open("L7")).toContain("1 relation added");
  });
});

// ─── L8 · Argdown export ──────────────────────────────────────────────────────

describe("L8 — an argument with a `possible` premise is exported as a different argument", () => {
  it("J1 and J2 jointly entail P1 is written as J1 entails P1", () => {
    const s = state(
      [
        el("J1", "judgment"),
        el("J2", "judgment", { status: "possible" }),
        el("P1", "principle"),
      ],
      [
        rel("J1", "P1", "jointly_entails", { argumentId: "a" }),
        rel("J2", "P1", "jointly_entails", { argumentId: "a" }),
      ],
    );
    const argdown = buildArgdown(s);
    // Fixed when the argument is left out whole, as a relation touching a
    // `possible` element is.
    expect(argdown, open("L8")).toMatch(/\(1\) \[J1\]\n----\n\(2\) \[P1\]/);
  });
});

// ─── L9 · Coherence ───────────────────────────────────────────────────────────

describe("L9 — a joint argument with a withdrawn premise still counts as a tension", () => {
  it("lists the held premise against the conclusion", () => {
    const { tensions } = computeCoherence(
      [
        el("P1", "principle"),
        el("J1", "judgment", {
          status: "withdrawn",
          history: [{ round: 2, type: "withdrawn" }],
        }),
        el("J2", "judgment"),
      ],
      [
        rel("P1", "J2", "jointly_precludes", { argumentId: "a" }),
        rel("J1", "J2", "jointly_precludes", { argumentId: "a" }),
      ],
    );
    // Fixed when this is []: P1 alone precludes nothing.
    expect(tensions, open("L9")).toEqual(["P1 jointly precludes J2"]);
  });
});

// ─── L10 · The relation matrix ────────────────────────────────────────────────

describe("L10 — nothing holds a relation to skill/re-relations-reference.md", () => {
  it("the add bar accepts Judgment → Theory, a pair the matrix does not list", () => {
    // Recorded as a disagreement between CLAUDE.md ("which pairs … may legally
    // hold which relation is the full matrix") and the code; the audit argues
    // the document should change, in which case this test goes with it.
    expect(checkRelation({ from: "J1", to: "T1" }, 3), open("L10")).toEqual({
      valid: true,
      complaint: null,
    });
  });
});

// ─── U3 · The relation form's first complaint ─────────────────────────────────

describe("U3 — an untouched relation form complains that From ≠ To", () => {
  it("with neither end picked", () => {
    // Fixed when it asks for the two ends instead.
    expect(checkRelation({ from: "", to: "" }, 3).complaint, open("U3")).toBe(
      "From ≠ To",
    );
  });
});
