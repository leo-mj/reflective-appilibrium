/**
 * @fileoverview Asks the backend what it can actually do, once per mount.
 *
 * Build-time flags say whether a backend exists; they cannot say what that
 * backend is configured to allow. Server-side session storage in particular is
 * on for a local install and off for a hosted one, and the browser has no way
 * to know which it is talking to. Offering Save and then failing with a 403 is
 * worse than not offering it, so the controls are gated on this.
 *
 * @module hooks/useBackendCapabilities
 */

import { useSyncExternalStore } from "react";
import { BACKEND_ENABLED } from "../config.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * @typedef {Object} BackendCapabilities
 * @property {boolean} loaded      False until the health check settles either way.
 * @property {boolean} reachable   Whether the backend answered at all.
 * @property {boolean} sessions    Whether it persists sessions to disk.
 * @property {number}  maxElements Largest sentence pool it will compute over;
 *   0 means no cap, which is also what an older backend is assumed to have.
 */

/** What we assume before the health check answers, and if it never does. */
const UNAVAILABLE = {
  loaded: false,
  reachable: false,
  sessions: false,
  maxElements: 0,
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
        // `?? false`: an older backend has no `sessions` field, and treating
        // absence as "yes" would put the Save button back on a server that
        // may refuse it.
        sessions: data?.sessions ?? false,
        // `?? 0`: absence means "no cap known", and guessing a number would
        // hide badges a backend would have answered.
        maxElements: data?.max_simulation_elements ?? 0,
      }),
    )
    .catch(() => settle({ ...UNAVAILABLE, loaded: true }));
  return inFlight;
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
