/**
 * @fileoverview Backend client for the relatedness matrix endpoint.
 * @module utils/matrixClient
 */

/** @import { REState } from '../types.js' */

import _dummyMatrix from "../dummy-matrix.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * Asks the backend LLM service to compute a relatedness matrix for the
 * judgments and principles in the given RE state.
 *
 * @param {REState} state
 * @returns {Promise<{ overview: string, matrix: Object, pairDescriptions: Object, _model: string }>}
 */
export async function fetchRelatednessMatrix(state) {
  if (import.meta.env.VITE_USE_DUMMY === "true") {
    return { ...JSON.parse(_dummyMatrix), _model: "dummy" };
  }
  const res = await fetch(`${BACKEND_URL}/api/matrix/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  return {
    overview: data.overview,
    matrix: data.matrix,
    pairDescriptions: data.pairDescriptions,
    _model: data.model,
  };
}
