import _dummyState from "./dummy-state.js"; // dev fixture — not used in production builds

// ============================================================
// REPLACE THIS OBJECT WITH CURRENT STATE DATA WHEN GENERATING
// ============================================================
const _inlineState = {
  topic: "",
  phase: 0,
  round: 0,
  elements: [
    // { id: "J1", type: "judgment", status: "active", confidence: "high", origin: "user", text: "...", addedRound: 1 },
    // { id: "P1", type: "principle", status: "active", confidence: "moderate", origin: "user", text: "...", addedRound: 1 },
    // { id: "T1", type: "theory", status: "active", confidence: "high", origin: "assistant-suggested → user-adopted", text: "...", addedRound: 5 },
    // For revised elements, add: previousText: "...", revisedRound: N
    // For withdrawn elements, add: reason: "...", withdrawnRound: N
  ],
  relations: [
    // { from: "J1", to: "P1", type: "supports", explanation: "...", addedRound: 1 },
    // types: "supports", "conflicts", "undermines", "depends"
  ],
  coherence: {
    tensions: [],
    orphans: [],
    clusters: [],
  },
  log: [
    // { round: 1, findings: "...", options: "...", decision: "...", changes: "..." }
  ],
};
// ============================================================

export const SAMPLE_STATE = import.meta.env.VITE_USE_DUMMY_STATE ? _dummyState : _inlineState;
