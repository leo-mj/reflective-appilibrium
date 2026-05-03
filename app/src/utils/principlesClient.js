/**
 * @fileoverview Backend client for the principle suggestion endpoint.
 * @module utils/principlesClient
 */

/** @import { REState } from '../types.js' */

import dummyPrinciples from "../dummy-principles.js";
import { LLM_ENABLED } from "../config.js";
import { getLLMHeaders } from "./openaiClient.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * Asks the backend LLM service to suggest new principles that systematise
 * the judgments in the given RE state.
 *
 * @param {REState} state
 * @param {boolean} [useDummy=false]
 * @returns {Promise<{ suggestions: Array<{text: string, confidence: string, covers: string[], explanation: string}>, model: string }>}
 */
export async function fetchPrincipleSuggestions(state, useDummy = false) {
  if (!LLM_ENABLED || useDummy) {
    return dummyPrinciples;
  }
  const res = await fetch(`${BACKEND_URL}/api/principles/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getLLMHeaders() },
    body: JSON.stringify({
      topic: state.topic,
      elements: state.elements,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backend error ${res.status}: ${body}`);
  }
  return res.json();
}
