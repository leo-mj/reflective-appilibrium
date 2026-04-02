/**
 * @fileoverview Backend LLM client — routes all LLM calls through the FastAPI
 * backend so API keys are never exposed in the browser.
 * @module utils/openaiClient
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * Sends a prompt to the backend LLM service and returns the raw text response
 * along with the model name used.
 *
 * @param {string} prompt
 * @param {number} [temperature=0.3]
 * @returns {Promise<{ text: string, model: string }>}
 */
export async function callBackendLLM(prompt, temperature = 0.3) {
  console.log(`Fetching response from LLM`);
  const res = await fetch(`${BACKEND_URL}/api/llm/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  return res.json();
}
