/**
 * @fileoverview Backend client for the sessions storage endpoints.
 * @module utils/sessionsClient
 */

/** @import { REState } from '../types.js' */

import { BACKEND_URL } from "../config.js";
import { fetchOk } from "./backendError.js";

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
  const res = await fetchOk(`${BACKEND_URL}/api/sessions`, undefined, "/api/sessions");
  return res.json();
}

/**
 * @param   {string}        id  session_id
 * @returns {Promise<REState>}
 */
export async function loadSession(id) {
  const res = await fetchOk(
    `${BACKEND_URL}/api/sessions/${encodeURIComponent(id)}`,
    undefined,
    "/api/sessions/{id}",
  );
  return res.json();
}

/**
 * @param   {string}        id  session_id
 * @returns {Promise<void>}
 */
export async function deleteSession(id) {
  await fetchOk(
    `${BACKEND_URL}/api/sessions/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "/api/sessions/{id}",
  );
}

/**
 * Saves the current RE state to the backend.
 *
 * @param   {REState}              state
 * @returns {Promise<SessionMeta>} Metadata for the newly saved session.
 */
export async function saveSession(state) {
  const res = await fetchOk(
    `${BACKEND_URL}/api/sessions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    },
    "/api/sessions",
  );
  return res.json();
}
