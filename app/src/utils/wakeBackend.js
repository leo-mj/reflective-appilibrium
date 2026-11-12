/**
 * @fileoverview Wakes a backend that has scaled to zero, and keeps track of how
 * far it has got.
 *
 * A hosted backend stops when nobody uses it, and the first request after a
 * quiet spell waits for a new instance. That wait has two parts: the server
 * starting, which ends when the health check answers, and its workers starting,
 * which is where the rethon stack is loaded and which the warm-up request asks
 * for. The start page begins both as it appears (`wakeBackend`), so that most
 * of the wait passes while the reader is there; and the editor shows what is
 * left of it (`ServerWakeNotice`), since that is where someone would be left
 * waiting with nothing to say why.
 *
 * The phases, in order: `idle` until asked, `starting` until the health check
 * settles, `warming` until the workers are up, then `ready` — or `unavailable`
 * if the backend did not answer at all, which the rest of the app already
 * handles in its own way. A warm-up that fails or that an older backend does
 * not know still ends in `ready`: the workers then start on the first
 * computation, as they always did. A request that later reaches no server
 * starts it over from `starting` (`rewakeBackend`).
 *
 * @module utils/wakeBackend
 */

import { useSyncExternalStore } from "react";
import { BACKEND_ENABLED } from "../config.js";
import {
  prefetchBackendCapabilities,
  recheckBackendCapabilities,
} from "../hooks/useBackendCapabilities.js";
import { onBackendUnreachable, setStartingUpCheck } from "./backendError.js";
import { warmBackendWorkers } from "./simulateRethonClient.js";

/**
 * @typedef {"idle"|"starting"|"warming"|"ready"|"unavailable"} WakePhase
 * @typedef {Object} WakeState
 * @property {WakePhase}   phase
 * @property {number|null} since When the wait began (ms since the epoch), while
 *   there is one.
 * @property {"page"|"failure"|null} reason What started the wake-up: the page
 *   opening, or a request that reached no server.
 */

/** @returns {WakeState} */
const initial = () => ({
  phase: BACKEND_ENABLED ? "idle" : "ready",
  since: null,
  reason: null,
});

let state = initial();
const listeners = new Set();

function set(next) {
  state = next;
  listeners.forEach((fn) => fn());
}

/**
 * How long after a wake-up finishes a request that reaches no server still
 * counts as part of the start. A freshly started instance can still turn a
 * request away for a moment, and calling that "could not reach the server"
 * would alarm someone over what is still the same wait.
 */
export const STARTUP_GRACE_MS = 30_000;

// When the last wake-up ended in `ready`, for the grace above.
let readyAt = null;

// What started the current wake-up: the page opening ("page"), when a hosted
// server is expected to be asleep, or a request that reached no server
// ("failure"), when it may as well be down.
let wokenBy = null;

/**
 * Whether the server is starting up: woken as the page opened and not yet
 * answering, answering and loading its workers, or done moments ago. A request
 * that reaches no server then fails as `ServerStartingError`, and at any other
 * time as the more serious `ServerUnreachableError` — including while a wake-up
 * that a failure started is still waiting for an answer.
 *
 * @returns {boolean}
 */
export function isStartingUp() {
  // A wake-up that a failed request started is not evidence of a start: the
  // server may be down. Only once it answers again was it a restart.
  if (state.phase === "starting") return wokenBy === "page";
  if (state.phase === "warming") return true;
  return (
    state.phase === "ready" &&
    readyAt != null &&
    Date.now() - readyAt < STARTUP_GRACE_MS
  );
}

// Which wake-up is current. A request failing mid-way through one starts
// another, and the earlier one's answers must not overwrite the later's phase.
let generation = 0;

function run(check, reason) {
  const mine = ++generation;
  wokenBy = reason;
  const since = Date.now();
  set({ phase: "starting", since, reason });
  const current = () => mine === generation;
  return check().then(async (capabilities) => {
    if (!current()) return;
    if (!capabilities?.reachable) {
      set({ phase: "unavailable", since: null, reason });
      return;
    }
    set({ phase: "warming", since, reason });
    await warmBackendWorkers();
    if (!current()) return;
    readyAt = Date.now();
    set({ phase: "ready", since: null, reason });
  });
}

/**
 * Starts the health check, then the warm-up. Once per page load; later calls do
 * nothing. In the demo build there is nothing to wake.
 *
 * @returns {Promise<void>|undefined}
 */
export function wakeBackend() {
  if (state.phase !== "idle") return undefined;
  return run(prefetchBackendCapabilities, "page");
}

/**
 * Wakes the server again, after a request reached none.
 *
 * A hosted backend scales to zero after a quiet spell, so a page left open goes
 * on talking to a server that has gone; the next request starts a new one, and
 * the platform may answer it before that one is up. So any request that reaches
 * no server (`onBackendUnreachable`) starts the wake-up over — health check with
 * its retries, then the warm-up, the new instance's workers being cold — and the
 * notice shows the wait. A wake-up still waiting for the health check is left
 * to finish: it is already asking.
 *
 * @returns {Promise<void>|undefined}
 */
export function rewakeBackend() {
  if (!BACKEND_ENABLED || state.phase === "starting") return undefined;
  return run(recheckBackendCapabilities, "failure");
}

onBackendUnreachable(() => {
  rewakeBackend();
});
setStartingUpCheck(isStartingUp);

/** @returns {WakeState} */
export function useBackendWake() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
    () => state,
  );
}

/** Forgets the wake-up. For tests. */
export function resetBackendWake() {
  generation += 1;
  readyAt = null;
  wokenBy = null;
  state = initial();
  listeners.clear();
}
