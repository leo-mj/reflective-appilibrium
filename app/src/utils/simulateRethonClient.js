/**
 * @fileoverview Backend client for the simulate_rethon endpoint.
 * @module utils/simulateRethonClient
 */

/** @import { REState } from '../types.js' */

import { BACKEND_ENABLED } from "../config.js";
import { dummyRoundScores, dummyWithdrawalDeltas, dummySimulationResult } from "../dummy-data/dummy-rethon-scores.js";
import { getLLMHeaders, accumulateUsage } from "./openaiClient.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * Sends active elements to the backend, which runs the rethon RE simulation
 * and returns detected arguments, the RE state evolution, and token usage.
 *
 * @param {REState} state
 * @param {boolean} [useDummy=false]
 * @returns {Promise<Object>}
 */
/**
 * Advances the step-by-step RE simulation by one step.
 *
 * Pass ``evolution = null`` on the first call to start from the initial
 * commitments.  On every subsequent call pass the ``evolution`` array from
 * the previous response so the server can reconstruct the RE state and
 * continue exactly where it left off.
 *
 * @param {REState} state
 * @param {boolean} local
 * @param {Array[]|null} evolution  - translated_re_state.evolution from the previous response
 * @returns {Promise<{translated_arguments: Array, translated_re_state: Object}>}
 */
export async function simulateRethonStep(state, local, evolution = null, weights = null) {
  if (!BACKEND_ENABLED) return dummySimulationResult;
  const url = `${BACKEND_URL}/api/simulate_rethon/step`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getLLMHeaders() },
    body: JSON.stringify({
      elements: state.elements,
      relations: state.relations.filter(
        (r) => r.type === "jointly_entails" || r.type === "jointly_precludes",
      ),
      round: `${state.round}`,
      local,
      evolution,
      weights,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Computes the equilibrium Z-score for each workflow round (1 → state.round).
 *
 * The server filters elements and relations to those present at each round
 * before running the rethon simulation.  Rounds that cannot be simulated
 * (too few elements, no arguments) come back with ``scores: null``.
 *
 * @param {REState} state
 * @param {boolean} [local=true]
 * @param {Object|null} [weights=null]
 * @returns {Promise<{round_scores: Array<{round: number, scores: Object|null}>}>}
 */
/**
 * Runs a full simulation on the given elements+relations and returns only the
 * final equilibrium Z-score.  Returns ``null`` on any error (too few elements,
 * no arguments, etc.).  Intended for lightweight inline delta previews.
 *
 * @param {Array}       elements   - Full elements list (may include one temp element).
 * @param {Array}       relations
 * @param {boolean}     [local=true]
 * @param {Object|null} [weights=null]
 * @returns {Promise<{z, account, systematicity, faithfulness}|null>}
 */
/**
 * Compute account and systematicity for an element set analytically.
 *
 * Derives C (all active/revised/rejected elements) and T (active/revised
 * principle/theory elements) from element types — no prior simulation needed.
 * Returns ``{ account, systematicity }`` or ``null`` when scoring is not
 * possible (too few elements, no argument relations, no theory elements).
 *
 * @param {Array}       elements
 * @param {Array}       relations
 * @param {Object|null} [weights=null]
 * @returns {Promise<{account: number, systematicity: number}|null>}
 */
export async function quickScore(elements, relations, weights = null) {
  if (!BACKEND_ENABLED) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/simulate_rethon/quick_score`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getLLMHeaders() },
      body: JSON.stringify({ elements, relations, weights }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.account != null ? { account: data.account, systematicity: data.systematicity } : null;
  } catch {
    return null;
  }
}

export async function scorePerRound(state, local = true, weights = null) {
  if (!BACKEND_ENABLED) {
    return { round_scores: dummyRoundScores };
  }
  const url = `${BACKEND_URL}/api/simulate_rethon/score_per_round`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getLLMHeaders() },
    body: JSON.stringify({
      elements: state.elements,
      relations: state.relations,
      round: state.round,
      local,
      weights,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Batch-computes withdrawal Z-score deltas for all active/revised J/P elements.
 *
 * The server builds the BDD once and runs one RE simulation per withdrawal
 * scenario, so this is much cheaper than N separate ``quickScore`` calls.
 *
 * Returns ``{ withdrawal_deltas: [{element_id, delta_account, delta_systematicity}] }`` or
 * ``null`` on any error.
 *
 * @param {REState}     state
 * @param {boolean}     [local=true]
 * @param {Object|null} [weights=null]
 * @returns {Promise<{baseline_z: number|null, withdrawal_deltas: Array}|null>}
 */
/**
 * Batch-compute withdrawal deltas (account and systematicity) for all
 * active/revised elements.
 *
 * Returns ``{ withdrawal_deltas: [{element_id, delta_account, delta_systematicity}] }``
 * or ``null`` on any error.
 *
 * @param {REState}     state
 * @param {boolean}     [local=true]
 * @param {Object|null} [weights=null]
 * @returns {Promise<{withdrawal_deltas: Array}|null>}
 */
export async function scoreChanges(state, local = true, weights = null) {
  if (!BACKEND_ENABLED) {
    return { withdrawal_deltas: dummyWithdrawalDeltas };
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/simulate_rethon/score_changes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getLLMHeaders() },
      body: JSON.stringify({
        elements: state.elements,
        relations: state.relations.filter(
          (r) => r.type === "jointly_entails" || r.type === "jointly_precludes",
        ),
        local,
        weights,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function simulateRethon(state, local, evolution = null, useDummy = false, weights = null) {
  if (!BACKEND_ENABLED) return dummySimulationResult;
  const url = useDummy
    ? `${BACKEND_URL}/api/simulate_rethon/simulate?use_dummy=true`
    : `${BACKEND_URL}/api/simulate_rethon/simulate`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getLLMHeaders() },
    body: JSON.stringify({
      elements: state.elements,
      relations: state.relations.filter((r) => r.type === "jointly_entails" || r.type === "jointly_precludes"),
      round: `${state.round}`,
      local,
      evolution,
      weights,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backend error ${res.status}: ${body}`);
  }
  const data = await res.json();
  accumulateUsage(data);
  return data;
}
