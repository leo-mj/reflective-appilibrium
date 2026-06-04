// Dummy rethon scores for the demo state (obligations to future generations).
// Rounds 1–6 have no argument relations yet, so scores are null.
// Rounds 7–8 have pre-computed account / systematicity / faithfulness / z values.

import dummyState from "./dummy-state.js";

function el(id) {
  return dummyState.elements.find((e) => e.id === id);
}

/** @type {Array<{round: number, scores: {z:number,account:number,systematicity:number,faithfulness:number}|null}>} */
export const dummyRoundScores = [
  { round: 1, scores: null },
  { round: 2, scores: null },
  { round: 3, scores: null },
  { round: 4, scores: null },
  { round: 5, scores: null },
  { round: 6, scores: null },
  // Round 7: arg-dummy-1 (T1+T2→P2) and arg-dummy-2 (P1+P5→J10) present.
  { round: 7, scores: { z: 0.531, account: 0.357, systematicity: 0.614, faithfulness: 0.720 } },
  // Round 8: arg-dummy-3 (P2+P3→J5) also present — slightly higher account.
  { round: 8, scores: { z: 0.553, account: 0.417, systematicity: 0.614, faithfulness: 0.728 } },
];

// Withdrawal deltas: how account and systematicity change if each active/revised
// element is removed.  Negative delta_account means the element is well-covered
// by the theory (removing it hurts account).  Positive delta_systematicity means
// the theory becomes leaner without that element.
//
// Covers all active/revised J/P/T elements from dummy-state.js.
export const dummyWithdrawalDeltas = [
  // ── Judgments (commitments) ──────────────────────────────────────────────────
  // J5 and J10 are conclusions of arguments; removing them slightly helps account
  // (one fewer commitment to cover that may not be perfectly entailed).
  // Uncovered judgments: removing them helps account (smaller denominator, same numerator).
  { element_id: "J1",  delta_account: +0.008, delta_systematicity: 0 },
  { element_id: "J2",  delta_account: +0.008, delta_systematicity: 0 },
  { element_id: "J3",  delta_account: +0.008, delta_systematicity: 0 },
  { element_id: "J4",  delta_account: +0.008, delta_systematicity: 0 },
  { element_id: "J5",  delta_account: +0.010, delta_systematicity: 0 },
  { element_id: "J7",  delta_account: +0.008, delta_systematicity: 0 },
  { element_id: "J8",  delta_account: +0.009, delta_systematicity: 0 },
  { element_id: "J9",  delta_account: +0.008, delta_systematicity: 0 },
  { element_id: "J10", delta_account: +0.012, delta_systematicity: 0 },
  { element_id: "J12", delta_account: +0.009, delta_systematicity: 0 },

  // ── Principles (theory elements) ─────────────────────────────────────────────
  // P1, P5 are premises of arg-dummy-2 (→J10); removing either loses that argument.
  // P2 is conclusion of arg-dummy-1 AND premise of arg-dummy-3; removing it loses both.
  // P3 is premise of arg-dummy-3 (→J5).
  // P6 is not in any argument; removing it only makes the theory leaner.
  { element_id: "P1", delta_account: -0.049, delta_systematicity: +0.033 },
  { element_id: "P2", delta_account: -0.087, delta_systematicity: +0.063 },
  { element_id: "P3", delta_account: -0.025, delta_systematicity: +0.025 },
  { element_id: "P5", delta_account: -0.049, delta_systematicity: +0.033 },
  { element_id: "P6", delta_account: -0.010, delta_systematicity: +0.038 },

  // ── Background theories ──────────────────────────────────────────────────────
  // T1, T2 are both premises of arg-dummy-1 (→P2); removing either loses that argument.
  { element_id: "T1", delta_account: -0.062, delta_systematicity: +0.043 },
  { element_id: "T2", delta_account: -0.062, delta_systematicity: +0.043 },
];

// ─── Simulation result ────────────────────────────────────────────────────────
//
// Pre-computed result for simulateRethon / simulateRethonStep when the backend
// is unavailable.  Models a 6-step evolution on the round-8 dummy state:
//
//   Step 0 (C): all active/revised judgments (initial commitments)
//   Step 1 (T): full theory incl. P6 (P6 not in any argument)
//   Step 2 (C): commitments stable (all judgments retained)
//   Step 3 (T): P6 dropped — theory leaner, account unchanged
//   Step 4 (C): commitments stable (fixed-point confirmation)
//   Step 5 (T): theory stable (fixed point reached)
//
// finished: true — equilibrium reached; all active judgments retained.

const committedJudgments = ["J1","J2","J3","J4","J5","J7","J8","J9","J10","J12"].map(el);
const initialTheory    = ["P1","P2","P3","P5","P6","T1","T2"].map(el);
const finalTheory      = ["P1","P2","P3","P5","T1","T2"].map(el); // P6 not in arguments → dropped

const sInit  = { z: 0.427, account: 0.200, systematicity: 0.571, faithfulness: 0.720 };
const sMid   = { z: 0.531, account: 0.357, systematicity: 0.614, faithfulness: 0.720 };
const sFinal = { z: 0.553, account: 0.417, systematicity: 0.614, faithfulness: 0.728 };

export const dummySimulationResult = {
  translated_arguments: [
    [el("T1"), el("T2"), el("P2")],  // arg-dummy-1
    [el("P1"), el("P5"), el("J10")], // arg-dummy-2
    [el("P2"), el("P3"), el("J5")],  // arg-dummy-3
  ],
  translated_re_state: {
    step_types: ["commitments", "theory", "commitments", "theory", "commitments", "theory"],
    evolution: [
      committedJudgments,
      initialTheory,
      committedJudgments,
      initialTheory,
      committedJudgments,
      finalTheory,
    ],
    scores: [null, sInit, sMid, sMid, sFinal, sFinal],
    finished: true,
  },
  model: "dummy data",
  input_tokens: 0,
  output_tokens: 0,
};
