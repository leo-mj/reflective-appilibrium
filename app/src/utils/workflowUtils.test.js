import { describe, it, expect } from "vitest";
import {
  completesIteration,
  nextPhaseEnabled,
  nextWorkflowPhase,
  REVIEW_EVERY,
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
  it("leaves processReview out of the iteration", () => {
    // The review is a stop between iterations, not a phase of one: the five
    // phases loop to build the position, and this one steps back and looks at
    // it. `nextWorkflowPhase` is the only thing that routes to it — so a review
    // never lands mid-iteration, and never comes round every time.
    expect(WORKFLOW_NEXT_PHASE).not.toHaveProperty("processReview");
    expect(Object.values(WORKFLOW_NEXT_PHASE)).not.toContain("processReview");
    // It still needs a label, since the button announces where it is going.
    expect(WORKFLOW_PHASE_LABELS).toHaveProperty("processReview");
  });

  it("runs the phases in the order the assist tabs are listed in", () => {
    // The tab strip reads as the workflow's running order, so the two must
    // agree — theories third in one and fourth in the other would make the tab
    // the reader clicks and the phase the button advances to different things.
    const phases = ASSIST_TABS.filter((t) => t in WORKFLOW_NEXT_PHASE);
    phases.forEach((phase, i) => {
      const next = phases[(i + 1) % phases.length];
      expect(WORKFLOW_NEXT_PHASE[phase]).toBe(next);
    });
  });

  it("puts theories after principles and before arguments", () => {
    // A theory has to bear on a principle, and an argument or relation drawn
    // before the theories are on the board is one the user has to draw again.
    expect(WORKFLOW_NEXT_PHASE.suggestPrinciples).toBe("suggestTheories");
    expect(WORKFLOW_NEXT_PHASE.suggestTheories).toBe("detectArguments");
  });

  it("keeps the iteration a closed loop, and labels every phase of it", () => {
    // A phase the loop cannot leave, or one the button cannot announce, is a
    // dead end either way.
    Object.entries(WORKFLOW_NEXT_PHASE).forEach(([phase, next]) => {
      expect(WORKFLOW_NEXT_PHASE).toHaveProperty(next);
      expect(WORKFLOW_PHASE_LABELS).toHaveProperty(phase);
    });
  });

  it("labels nothing the workflow cannot route to", () => {
    // The labels are what the next-phase button reads, so a key here that
    // `nextWorkflowPhase` never returns is a step the reader is promised and
    // never taken to.
    const reachable = new Set([
      ...Object.values(WORKFLOW_NEXT_PHASE),
      "processReview",
    ]);
    Object.keys(WORKFLOW_PHASE_LABELS).forEach((phase) => {
      expect(reachable).toContain(phase);
    });
  });

  it("draws every phase from the assist tabs", () => {
    Object.keys(WORKFLOW_NEXT_PHASE).forEach((phase) => {
      expect(ASSIST_TABS).toContain(phase);
    });
  });
});

// ─── where pressing on goes ───────────────────────────────────────────────────

describe("nextWorkflowPhase", () => {
  /** Walk the workflow from a standing start, collecting where it lands. */
  const walk = (steps, opts = {}) => {
    const seen = [];
    let phase = "elicitJudgments";
    let loops = 0;
    for (let i = 0; i < steps; i++) {
      const next = nextWorkflowPhase(phase, { ...opts, loops });
      if (completesIteration(phase, opts.hideNonEntailsRels)) loops++;
      phase = next;
      seen.push(phase);
    }
    return seen;
  };

  it("walks the iteration in order", () => {
    expect(walk(5)).toEqual([
      "suggestPrinciples",
      "suggestTheories",
      "detectArguments",
      "suggestRelations",
      "elicitJudgments",
    ]);
  });

  it(`stops at the review after every ${REVIEW_EVERY} iterations`, () => {
    // Five phases per iteration, so the fifth iteration's last press is the
    // 25th — and that one goes to the review rather than back to judgments.
    const seen = walk(REVIEW_EVERY * 5 + 1);
    expect(seen[REVIEW_EVERY * 5 - 1]).toBe("processReview");
    expect(seen.filter((p) => p === "processReview")).toHaveLength(1);
    // And the review hands back to the top of the next iteration.
    expect(seen[REVIEW_EVERY * 5]).toBe("elicitJudgments");
  });

  it("keeps counting iterations across a review", () => {
    // The review sits between two iterations rather than inside one, so the
    // count must not restart at it — the tenth iteration has to reach a review
    // as surely as the fifth.
    const seen = walk(REVIEW_EVERY * 10 + 1);
    expect(seen[REVIEW_EVERY * 5 - 1]).toBe("processReview");
    // One press later than the fifth, the extra one being the review itself.
    expect(seen[REVIEW_EVERY * 10]).toBe("processReview");
  });

  it("skips the relations phase when non-entails relations are hidden", () => {
    const opts = { hideNonEntailsRels: true };
    expect(nextWorkflowPhase("detectArguments", opts)).toBe("elicitJudgments");
    // And arguments then close the iteration, so the review still arrives.
    expect(
      nextWorkflowPhase("detectArguments", { ...opts, loops: REVIEW_EVERY - 1 }),
    ).toBe("processReview");
  });

  it("leaves the review for the top of the next iteration", () => {
    // Whatever the loop count and whatever is hidden: the review is a stop, and
    // the only way out of a stop is on.
    expect(nextWorkflowPhase("processReview")).toBe("elicitJudgments");
    expect(
      nextWorkflowPhase("processReview", {
        loops: REVIEW_EVERY,
        hideNonEntailsRels: true,
      }),
    ).toBe("elicitJudgments");
  });
});
