/**
 * @fileoverview Backend client for the arguments/detect endpoint.
 * @module utils/argumentsClient
 */

/** @import { REState } from '../types.js' */

import { getDummyArguments } from "../dummy-arguments.js";
import { LLM_ENABLED } from "../config.js";
import { getLLMHeaders, accumulateUsage } from "./openaiClient.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * Sends active elements to the backend, which returns detected arguments, added premises, and token usage.
 *
 * @param {REState} state
 * @param {boolean} [useDummy=false]
 * @returns {Promise<Object>}
 */
export async function detectArguments(state, useDummy = false) {
  if (!LLM_ENABLED || useDummy) {
    return getDummyArguments(state.elements, `${state.round}`, state.relations);
  }
  const res = await fetch(`${BACKEND_URL}/api/arguments/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getLLMHeaders() },
    body: JSON.stringify({
      elements: state.elements,
      round: `${state.round}`
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
