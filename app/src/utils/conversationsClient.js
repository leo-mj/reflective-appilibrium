/**
 * @fileoverview Client for the /api/conversations endpoint.
 * The server keeps nothing between turns, so every question is sent with the RE
 * state, the suggestion and the whole conversation so far.
 * @module utils/conversationsClient
 */

import { BACKEND_URL } from "../config.js";
import { getLLMHeaders } from "./openaiClient.js";
import { fetchOk } from "./backendError.js";

/**
 * Exchanges (a question and its reply) one conversation may hold — MAX_EXCHANGES
 * in backend/routers/conversations.py, which rejects a longer one.
 */
export const MAX_EXCHANGES = 20;

/**
 * Ask a question in a conversation about a suggestion.
 *
 * @param {import('../types.js').REState} state
 * @param {Object} suggestion  The suggestion object (any shape — serialised as-is).
 * @param {Array<{ role: "user" | "assistant", content: string }>} messages
 *   The conversation so far, ending with the new question.
 * @returns {Promise<{ reply: string, model: string }>}
 */
export async function askInConversation(state, suggestion, messages) {
  // The endpoint depends on get_llm_service, which rejects a missing x-base-url
  // before it looks at any key — so without these headers the panel 400s in
  // every deployment mode, server-side key or not. That 400 is exactly the one
  // backendError turns into "No API key configured", which is what it means to
  // whoever pressed the button.
  const res = await fetchOk(
    `${BACKEND_URL}/api/conversations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getLLMHeaders() },
      body: JSON.stringify({
        state,
        suggestion,
        messages: messages.map(({ role, content }) => ({ role, content })),
      }),
    },
    "/api/conversations",
  );
  return res.json();
}
