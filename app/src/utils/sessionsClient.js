/**
 * @fileoverview Backend client for the sessions storage endpoints.
 * @module utils/sessionsClient
 */

/** @import { REState } from '../types.js' */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * @typedef {Object} SessionMeta
 * @property {string}  session_id
 * @property {string}  topic
 * @property {number}  round
 * @property {string}  saved_at  ISO 8601 datetime string
 */

/**
 * @returns {Promise<SessionMeta[]>} Saved sessions, newest first.
 */
export async function fetchSessions() {
  const res = await fetch(`${BACKEND_URL}/api/sessions`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backend error ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * @param   {string}        id  session_id
 * @returns {Promise<REState>}
 */
export async function loadSession(id) {
  const res = await fetch(`${BACKEND_URL}/api/sessions/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backend error ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * @param   {string}        id  session_id
 * @returns {Promise<void>}
 */
export async function deleteSession(id) {
  const res = await fetch(
    `${BACKEND_URL}/api/sessions/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backend error ${res.status}: ${body}`);
  }
}

/**
 * Saves the current RE state to the backend.
 *
 * @param   {REState}              state
 * @returns {Promise<SessionMeta>} Metadata for the newly saved session.
 */
export async function saveSession(state) {
  const res = await fetch(`${BACKEND_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backend error ${res.status}: ${body}`);
  }
  return res.json();
}
