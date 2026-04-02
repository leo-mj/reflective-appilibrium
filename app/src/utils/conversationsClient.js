/**
 * @fileoverview Client for the /api/conversations endpoints.
 * Handles starting a new per-suggestion conversation and sending follow-up messages.
 * @module utils/conversationsClient
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Start a new conversation about a suggestion.
 * The RE state is injected server-side into the system prompt and not repeated
 * in subsequent requests.
 *
 * @param {import('../types.js').REState} state
 * @param {Object} suggestion  The suggestion object (any shape — serialised as-is).
 * @param {string} message     The user's first message.
 * @returns {Promise<{ session_id: string, reply: string, model: string }>}
 */
export async function startConversation(state, suggestion, message) {
  return post(`${BACKEND_URL}/api/conversations`, { state, suggestion, message });
}

/**
 * Send a follow-up message in an existing conversation.
 *
 * @param {string} sessionId
 * @param {string} message
 * @returns {Promise<{ session_id: string, reply: string, model: string }>}
 */
export async function sendConversationMessage(sessionId, message) {
  return post(
    `${BACKEND_URL}/api/conversations/${sessionId}/messages`,
    { message },
  );
}
