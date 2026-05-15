/**
 * @fileoverview Backend client for the relatedness matrix endpoint.
 * @module utils/matrixClient
 */

/** @import { REState } from '../types.js' */

import _dummyMatrix from "../dummy-data/dummy-matrix.js";
import { LLM_ENABLED } from "../config.js";
import { getLLMHeaders, accumulateUsage } from "./openaiClient.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * Asks the backend LLM service to compute a relatedness matrix for the
 * judgments and principles in the given RE state.
 *
 * @param {REState} state
 * @returns {Promise<{ overview: string, matrix: Object, pairDescriptions: Object, _model: string }>}
 */
export async function fetchRelatednessMatrix(state) {
  if (!LLM_ENABLED) {
    return { ...JSON.parse(_dummyMatrix), _model: "dummy" };
  }
  const res = await fetch(`${BACKEND_URL}/api/matrix/analyze`, {
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
  const data = await res.json();
  accumulateUsage(data);
  return {
    overview: data.overview,
    matrix: data.matrix,
    pairDescriptions: data.pairDescriptions,
    _model: data.model,
  };
}
