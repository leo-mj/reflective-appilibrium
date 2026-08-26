import { describe, it, expect } from "vitest";
import {
  nextPhaseEnabled,
  WORKFLOW_NEXT_PHASE,
  WORKFLOW_PHASE_LABELS,
} from "./workflowUtils.js";
import { ASSIST_TABS } from "../constants/tabConstants.jsx";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const activeJudgment = (id) => ({
  id,
  type: "judgment",
  status: "active",
  addedRound: 1,
});

const stateWith = (elements) => ({ elements });

// ─── nextPhaseEnabled ─────────────────────────────────────────────────────────

describe("nextPhaseEnabled", () => {
  describe("elicitJudgments phase", () => {
    it("returns false with 0 judgments", () => {
      expect(nextPhaseEnabled("elicitJudgments", stateWith([]))).toBe(false);
    });

    it("returns false with fewer than 3 active judgments", () => {
      const state = stateWith([activeJudgment("J1"), activeJudgment("J2")]);
      expect(nextPhaseEnabled("elicitJudgments", state)).toBe(false);
    });

    it("returns true with exactly 3 active judgments", () => {
      const state = stateWith([
        activeJudgment("J1"),
        activeJudgment("J2"),
        activeJudgment("J3"),
      ]);
      expect(nextPhaseEnabled("elicitJudgments", state)).toBe(true);
    });

    it("returns true with more than 3 active judgments", () => {
      const state = stateWith([
        activeJudgment("J1"),
        activeJudgment("J2"),
        activeJudgment("J3"),
        activeJudgment("J4"),
      ]);
      expect(nextPhaseEnabled("elicitJudgments", state)).toBe(true);
    });

    it("does not count withdrawn judgments", () => {
      const state = stateWith([
        activeJudgment("J1"),
        activeJudgment("J2"),
        { id: "J3", type: "judgment", status: "withdrawn", addedRound: 1 },
      ]);
      expect(nextPhaseEnabled("elicitJudgments", state)).toBe(false);
    });

    it("does not count rejected judgments", () => {
      const state = stateWith([
        activeJudgment("J1"),
        activeJudgment("J2"),
        { id: "J3", type: "judgment", status: "rejected", addedRound: 1 },
      ]);
      expect(nextPhaseEnabled("elicitJudgments", state)).toBe(false);
    });

    it("does not count active principles toward the judgment threshold", () => {
      const state = stateWith([
        activeJudgment("J1"),
        activeJudgment("J2"),
        { id: "P1", type: "principle", status: "active", addedRound: 1 },
      ]);
      expect(nextPhaseEnabled("elicitJudgments", state)).toBe(false);
    });
  });

  describe("other phases", () => {
    it("returns true for suggestPrinciples regardless of state", () => {
      expect(nextPhaseEnabled("suggestPrinciples", stateWith([]))).toBe(true);
    });

    it("returns true for suggestRelations regardless of state", () => {
      expect(nextPhaseEnabled("suggestRelations", stateWith([]))).toBe(true);
    });

    it("returns true when workflowPhase is null", () => {
      expect(nextPhaseEnabled(null, stateWith([]))).toBe(true);
    });
  });
});

// ─── the workflow's membership ────────────────────────────────────────────────

describe("the phase maps", () => {
  it("leaves processReview out of the workflow", () => {
    // Review is an assist tab but not a workflow phase: the four phases loop to
    // build the position, and this one steps back and looks at it. Being absent
    // from both maps is what stops advanceWorkflow ever landing on it, and what
    // keeps the next-phase control out of its toolbar.
    expect(WORKFLOW_NEXT_PHASE).not.toHaveProperty("processReview");
    expect(WORKFLOW_PHASE_LABELS).not.toHaveProperty("processReview");
    expect(Object.values(WORKFLOW_NEXT_PHASE)).not.toContain("processReview");
  });

  it("leaves suggestTheories out of the workflow", () => {
    // Same reasoning as review, plus one of its own: the four phases loop to
    // build the position, and background theories enter later in the process.
    // Absence from both maps is also what stops a tab switch spending an LLM
    // call and a round of Crossref lookups on its own.
    expect(WORKFLOW_NEXT_PHASE).not.toHaveProperty("suggestTheories");
    expect(WORKFLOW_PHASE_LABELS).not.toHaveProperty("suggestTheories");
    expect(Object.values(WORKFLOW_NEXT_PHASE)).not.toContain("suggestTheories");
  });

  it("keeps the loop closed over exactly the phases it labels", () => {
    // A phase named in one map and not the other is a phase the workflow either
    // cannot leave or cannot announce.
    expect(Object.keys(WORKFLOW_NEXT_PHASE).sort()).toEqual(
      Object.keys(WORKFLOW_PHASE_LABELS).sort(),
    );
    Object.values(WORKFLOW_NEXT_PHASE).forEach((next) => {
      expect(WORKFLOW_NEXT_PHASE).toHaveProperty(next);
    });
  });

  it("draws every phase from the assist tabs", () => {
    Object.keys(WORKFLOW_NEXT_PHASE).forEach((phase) => {
      expect(ASSIST_TABS).toContain(phase);
    });
  });
});
