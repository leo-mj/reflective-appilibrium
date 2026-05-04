import { describe, it, expect } from "vitest";
import { nextPhaseEnabled } from "./workflowUtils.js";

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
