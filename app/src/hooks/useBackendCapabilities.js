/**
 * @fileoverview Asks the backend what it can actually do, once per page load.
 *
 * Build-time flags say whether a backend exists; they cannot say what that
 * backend is configured to allow. The element cap in particular is a server
 * setting, and a browser that guesses it asks for work the server can only
 * refuse — so the controls that depend on it are gated on this.
 *
 * @module hooks/useBackendCapabilities
 */

import { useSyncExternalStore } from "react";
import { BACKEND_ENABLED, BACKEND_URL } from "../config.js";

/**
 * @typedef {Object} BackendCapabilities
 * @property {boolean} loaded      False until the health check settles either way.
 * @property {boolean} reachable   Whether the backend answered at all.
 * @property {number}  maxElements Largest sentence pool it will compute over;
 *   0 means no cap, which is also what an older backend is assumed to have.
 * @property {"local"|"hosted"|null} deployment The server's declared posture;
 *   null until known. Hosted, it refuses loopback provider URLs.
 * @property {number}  maxDepth    Deepest neighbourhood a simulation may search;
 *   0 means no cap beyond the request's own limit of 4.
 */

/** What we assume before the health check answers, and if it never does. */
const UNAVAILABLE = {
  loaded: false,
  reachable: false,
  maxElements: 0,
  deployment: null,
  maxDepth: 0,
};

// One check per page load, shared by every caller.
//
// This used to fetch once per mount, which was fine while REState was the only
// caller. ScoreDeltaBadge needs the element cap and there is one of those per
// suggestion card, so a per-mount fetch would mean ten health checks to render
// one tab. The promise is created on first use and reused thereafter; the store
// below is what lets components subscribe to its result.
let inFlight = null;
let current = BACKEND_ENABLED ? UNAVAILABLE : { ...UNAVAILABLE, loaded: true };

const listeners = new Set();

/**
 * Subscribing is also what starts the check: the first component to want these
 * capabilities triggers the one request, and every later one joins it.
 */
const subscribe = (fn) => {
  listeners.add(fn);
  load();
  return () => listeners.delete(fn);
};

function settle(next) {
  current = next;
  listeners.forEach((fn) => fn());
}

function load() {
  if (!BACKEND_ENABLED || inFlight) return inFlight;
  // A backend that is simply down must not leave the page waiting: a failed
  // check settles as "nothing available", which is the state the demo build is
  // in permanently.
  inFlight = fetch(`${BACKEND_URL}/api/health`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) =>
      settle({
        loaded: true,
        reachable: data !== null,
        // `?? 0`: absence means "no cap known", and guessing a number would
        // hide badges a backend would have answered.
        maxElements: data?.max_simulation_elements ?? 0,
        deployment: data?.deployment ?? null,
        maxDepth: data?.max_neighbourhood_depth ?? 0,
      }),
    )
    .catch(() => settle({ ...UNAVAILABLE, loaded: true }))
    // Resolves to what was settled, for callers that act on the answer rather
    // than render it (utils/wakeBackend.js).
    .then(() => current);
  return inFlight;
}

/**
 * Starts the shared health check without waiting for a component to want it.
 *
 * The check doubles as the backend's wake-up call: a hosted backend that has
 * scaled to zero starts an instance when the first request reaches it, and
 * that takes tens of seconds. Left to the first subscriber, the request went
 * out only once the editor opened, so the whole start-up landed on the reader's
 * first minute in it. Called from the start page, the start-up happens while
 * they are still reading it.
 *
 * It is the same request the app makes anyway — later subscribers join it —
 * so it costs nothing extra, and in the demo build it does nothing.
 *
 * @returns {Promise<BackendCapabilities>|null} The settled capabilities, or
 *   null in the demo build, where nothing is asked.
 */
export function prefetchBackendCapabilities() {
  return load();
}

/**
 * @returns {BackendCapabilities}
 */
export function useBackendCapabilities() {
  // A module store read through useSyncExternalStore rather than state synced by
  // an effect — the same shape as utils/llmKey.js, and for the same reason. It
  // also removes the gap an effect leaves: a component whose first render lands
  // after the shared check settled reads the settled value immediately, with no
  // second render to correct itself.
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}

/** Forgets the cached health check. For tests. */
export function resetBackendCapabilities() {
  inFlight = null;
  current = BACKEND_ENABLED ? UNAVAILABLE : { ...UNAVAILABLE, loaded: true };
  listeners.clear();
}
