/**
 * @fileoverview Backend LLM client — routes all LLM calls through the FastAPI
 * backend so API keys are never exposed in the browser.
 * @module utils/openaiClient
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * Returns BYOK request headers from sessionStorage, or an empty object if
 * no LLM settings have been saved.
 *
 * @returns {Record<string, string>}
 */
export function getLLMHeaders() {
  const raw = sessionStorage.getItem("llmSettings");
  if (!raw) return {};
  const { apiKey, baseUrl, model } = JSON.parse(raw);
  const headers = {};
  if (apiKey) headers["x-api-key"] = apiKey;
  if (baseUrl) headers["x-base-url"] = baseUrl;
  if (model) headers["x-model"] = model;
  return headers;
}

/**
 * Returns cumulative token usage for this session from sessionStorage.
 *
 * @returns {{ input: number, output: number }}
 */
export function getSessionUsage() {
  try {
    return JSON.parse(sessionStorage.getItem("llmUsage") || '{"input":0,"output":0}');
  } catch {
    return { input: 0, output: 0 };
  }
}

/** Resets the session token counter. */
export function clearSessionUsage() {
  sessionStorage.removeItem("llmUsage");
}

/**
 * Adds token counts from an LLM response to the session accumulator.
 * Works with any response that has top-level input_tokens / output_tokens fields.
 *
 * @param {{ input_tokens?: number, output_tokens?: number }} data
 */
export function accumulateUsage(data) {
  if (!data.input_tokens && !data.output_tokens) return;
  const prev = getSessionUsage();
  sessionStorage.setItem(
    "llmUsage",
    JSON.stringify({
      input: prev.input + (data.input_tokens || 0),
      output: prev.output + (data.output_tokens || 0),
    })
  );
}

/**
 * Sends a prompt to the backend LLM service and returns the raw text response
 * along with the model name used.
 *
 * @param {string} prompt
 * @param {number} [temperature=0.3]
 * @returns {Promise<{ text: string, model: string, usage: { input_tokens: number, output_tokens: number } }>}
 */
export async function callBackendLLM(prompt, temperature = 0.3) {
  const res = await fetch(`${BACKEND_URL}/api/llm/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getLLMHeaders() },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      temperature,
      json_mode: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backend error ${res.status}: ${body}`);
  }
  const data = await res.json();
  if (data.usage) {
    const prev = getSessionUsage();
    sessionStorage.setItem(
      "llmUsage",
      JSON.stringify({
        input: prev.input + (data.usage.input_tokens || 0),
        output: prev.output + (data.usage.output_tokens || 0),
      })
    );
  }
  return data;
}
