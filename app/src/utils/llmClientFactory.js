/**
 * @fileoverview Factory for LLM backend client functions.
 * All clients POST to a backend endpoint, accumulate token usage, and
 * fall back to sample data when LLM_ENABLED is false or useDummy is true.
 * @module utils/llmClientFactory
 */

import { LLM_ENABLED } from "../config.js";
import { getLLMHeaders, accumulateUsage } from "./openaiClient.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * @param {Object}   options
 * @param {string}   options.endpoint          Path appended to BACKEND_URL, e.g. "/api/judgments/elicit".
 * @param {*|Function} options.dummyData       Static fallback value, or (state) => value for state-dependent dummies.
 * @param {Function} options.buildBody         (state) => plain object to JSON-serialize as the request body.
 * @param {Function} [options.transformResponse] (data) => transformed value. Defaults to identity.
 * @returns {(state: Object, useDummy?: boolean, extraBody?: Object) => Promise<*>}
 */
export function makeLLMClient({ endpoint, dummyData, buildBody, transformResponse = (d) => d }) {
  return async function (state, useDummy = false, extraBody = {}) {
    if (!LLM_ENABLED || useDummy) {
      return typeof dummyData === "function" ? dummyData(state) : dummyData;
    }
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getLLMHeaders() },
      body: JSON.stringify({ ...buildBody(state), ...extraBody }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[${endpoint}] Backend error ${res.status}: ${body}`);
    }
    const data = await res.json();
    accumulateUsage(data);
    return transformResponse(data);
  };
}
