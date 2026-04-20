/**
 * @fileoverview Backend client for the judgment elicitation endpoint.
 * @module utils/judgmentsClient
 */

/** @import { REState } from '../types.js' */

import dummyJudgments from "../dummy-judgments.js";
import { LLM_ENABLED } from "../config.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * Asks the backend LLM service to suggest questions and thought experiments
 * that may elicit new judgments from the user.
 *
 * @param {REState} state
 * @param {boolean} [useDummy=false]
 * @returns {Promise<{ suggestions: Array<{question: string, judgments: Array<{text: string, confidence: string}>}>, model: string }>}
 */
export async function fetchJudgmentElicitations(state, useDummy = false) {
  if (!LLM_ENABLED || useDummy) {
    return dummyJudgments;
  }
  const res = await fetch(`${BACKEND_URL}/api/judgments/elicit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: state.topic,
      elements: state.elements,
      log: state.log,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backend error ${res.status}: ${body}`);
  }
  return res.json();
}
