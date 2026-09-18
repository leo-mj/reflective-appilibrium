/**
 * @fileoverview Backend client for the simulate_rethon endpoint.
 * @module utils/simulateRethonClient
 */

/** @import { REState } from '../types.js' */

import { BACKEND_ENABLED, BACKEND_URL } from "../config.js";
import { getLLMHeaders, accumulateUsage } from "./openaiClient.js";
import { ARGUMENT_RELATION_TYPES } from "./stateUtils.js";
import { backendError } from "./backendError.js";

/**
 * The console line for a scoring call that failed.
 *
 * The two scoring endpoints swallow their failures by design — they decorate,
 * and a blank badge is the right fallback — so this is the only trace they
 * leave. Built through `backendError` so the wording matches what a visible
 * failure would have said.
 *
 * @param {Response} res
 * @param {string} endpoint
 * @returns {Promise<string>}
 */
async function describeScoringFailure(res, endpoint) {
  const err = await backendError(res, endpoint);
  return `[${endpoint}] scoring unavailable — ${err.message}`;
}

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
 * @param {Object|null} [weights=null]
 * @param {number} [neighbourhoodDepth=1]
 * @param {{signal?: AbortSignal}} [options]  Aborting stops the computation on
 *   the server too: it watches for the dropped connection and kills the worker.
 * @returns {Promise<{translated_arguments: Array, translated_re_state: Object}>}
 */
export async function simulateRethonStep(state, local, evolution = null, weights = null, neighbourhoodDepth = 1, { signal } = {}) {
  const url = `${BACKEND_URL}/api/simulate_rethon/step`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", ...getLLMHeaders() },
    body: JSON.stringify({
      elements: state.elements,
      relations: state.relations.filter(
        (r) => ARGUMENT_RELATION_TYPES.has(r.type),
      ),
      round: `${state.round}`,
      local,
      evolution,
      weights,
      neighbourhood_depth: neighbourhoodDepth,
    }),
  });
  if (!res.ok) throw await backendError(res, url);
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
    // Still null rather than a throw: this decorates the suggestion cards with a
    // score badge and fires on every edit, so it must not be able to fail a
    // render. But null is also what "too few elements to score" looks like, so
    // without this line a 429 from the scoring bucket or a 422 from the element
    // cap is indistinguishable from a graph that is simply too small — to the
    // reader and to whoever is debugging it.
    if (!res.ok) {
      console.warn(await describeScoringFailure(res, "quick_score"));
      return null;
    }
    const data = await res.json();
    return data.account != null ? { account: data.account, systematicity: data.systematicity } : null;
  } catch (e) {
    console.warn(`[quick_score] ${e.message}`);
    return null;
  }
}

export async function scorePerRound(state, local = true, weights = null) {
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
  if (!res.ok) throw await backendError(res, url);
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
  if (!BACKEND_ENABLED) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/simulate_rethon/score_changes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getLLMHeaders() },
      body: JSON.stringify({
        elements: state.elements,
        relations: state.relations.filter(
          (r) => ARGUMENT_RELATION_TYPES.has(r.type),
        ),
        local,
        weights,
      }),
    });
    // Silent for the same reason as quickScore, and logged for the same reason.
    if (!res.ok) {
      console.warn(await describeScoringFailure(res, "score_changes"));
      return null;
    }
    return res.json();
  } catch (e) {
    console.warn(`[score_changes] ${e.message}`);
    return null;
  }
}

/**
 * Runs the RE process to a fixed point, resuming from `evolution` if given.
 * Takes the same `{ signal }` option as `simulateRethonStep`, to the same effect.
 */
export async function simulateRethon(state, local, evolution = null, weights = null, neighbourhoodDepth = 1, { signal } = {}) {
  const url = `${BACKEND_URL}/api/simulate_rethon/simulate`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", ...getLLMHeaders() },
    body: JSON.stringify({
      elements: state.elements,
      relations: state.relations.filter((r) => ARGUMENT_RELATION_TYPES.has(r.type)),
      round: `${state.round}`,
      local,
      evolution,
      weights,
      neighbourhood_depth: neighbourhoodDepth,
    }),
  });
  if (!res.ok) throw await backendError(res, url);
  const data = await res.json();
  accumulateUsage(data);
  return data;
}
