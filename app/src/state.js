/**
 * @fileoverview RE state data source for the visualisation component.
 *
 * Exports {@link SAMPLE_STATE}, the single {@link REState} object consumed by
 * the entire component tree.  There are two sources:
 *
 * 1. **Inline state** (`_inlineState`) — an empty skeleton committed to the repo.
 *    Replace the `elements`, `relations`, `coherence`, and `log` arrays with real
 *    data produced by the Claude RE Skill when generating a visualisation artifact.
 *
 * 2. **Dummy state** (`dummy-state.js`) — a rich fixture used during development.
 *    Activated by setting the `VITE_USE_DUMMY_STATE=true` environment variable
 *    (see `.env` in the project root).
 *
 * @module state
 */

/** @import { REState } from './types.js' */

import _dummyState from "./dummy-state.js"; // dev fixture — not used in production builds

// ============================================================
// REPLACE THIS OBJECT WITH CURRENT STATE DATA WHEN GENERATING
// ============================================================
/**
 * Inline skeleton — swap the arrays below for real Claude output.
 * Every element must include `addedRound`.  Revised elements also need
 * `previousText` and `revisedRound`; withdrawn elements need `reason` and
 * `withdrawnRound`.
 *
 * @type {REState}
 */
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

/**
 * The active RE state used by all components.
 *
 * Source is chosen at build time via the `VITE_USE_DUMMY_STATE` env var:
 * - `"true"` → uses `dummy-state.js` (rich fixture, good for development)
 * - anything else → uses `_inlineState` (the skeleton defined above)
 *
 * @type {REState}
 */
export const SAMPLE_STATE = import.meta.env.VITE_USE_DUMMY_STATE ? _dummyState : _inlineState;
