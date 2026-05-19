/**
 * @fileoverview Backend client for the simulate_rethon endpoint.
 * @module utils/simulateRethonClient
 */

/** @import { REState } from '../types.js' */

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

export async function simulateRethon(state, local, evolution = null, useDummy = false, weights = null) {
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
