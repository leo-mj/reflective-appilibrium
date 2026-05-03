/**
 * @fileoverview Backend client for the relation suggestion endpoint.
 * @module utils/relationsClient
 */

/** @import { REState } from '../types.js' */

import dummyRelations from "../dummy-relations.js";
import { LLM_ENABLED } from "../config.js";
import { getLLMHeaders, accumulateUsage } from "./openaiClient.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * Asks the backend LLM service to suggest relations between the elements in
 * the given RE state, excluding relations that already exist.
 *
 * @param {REState} state
 * @param {boolean} [useDummy=false]
 * @returns {Promise<{ suggestions: Array<{from: string, to: string, type: string, explanation: string}>, model: string }>}
 */
export async function fetchRelationSuggestions(state, useDummy = false) {
  if (!LLM_ENABLED || useDummy) {
    return dummyRelations;
  }
  const res = await fetch(`${BACKEND_URL}/api/relations/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getLLMHeaders() },
    body: JSON.stringify({
      topic: state.topic,
      elements: state.elements,
      existing_relations: state.relations,
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
