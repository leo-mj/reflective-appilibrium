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
export async function simulateRethon(state, local, useDummy = false) {
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
