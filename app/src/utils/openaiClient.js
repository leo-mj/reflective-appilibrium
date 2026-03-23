/**
 * @fileoverview OpenAI client configuration and low-level transport.
 * Swap this file out to point the app at a different LLM backend.
 * @module utils/openaiClient
 */

import OpenAI from "openai";

// ─── Configuration ────────────────────────────────────────────────────────────

/** Loaded from VITE_OPENAI_API_KEY in app/.env */
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

/** OpenAI model to use. Update here to switch models. */
export const OPENAI_MODEL = "gpt-5.4-mini";

/** OpenAI client instance. */
const openai = new OpenAI({ apiKey: OPENAI_API_KEY, dangerouslyAllowBrowser: true }); 
// DO NOT use this outside of local development, as it will expose your API key in the browser.

// ─── Transport ────────────────────────────────────────────────────────────────

/**
 * Sends a prompt to the OpenAI Responses API and returns the raw output text.
 *
 * @param {string} prompt
 * @param {number} [temperature=0.3]
 * @returns {Promise<string>}
 */
export async function callOpenAIAPI(prompt, temperature = 0.3) {
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
    temperature,
    text: { format: { type: "json_object" } },
  });
  return response.output_text;
}
