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

import { useEffect, useState } from "react";
import { BACKEND_ENABLED } from "../config.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/**
 * @typedef {Object} BackendCapabilities
 * @property {boolean} loaded    False until the health check settles either way.
 * @property {boolean} reachable Whether the backend answered at all.
 * @property {boolean} sessions  Whether it persists sessions to disk.
 */

/** What we assume before the health check answers, and if it never does. */
const UNAVAILABLE = { loaded: false, reachable: false, sessions: false };

/**
 * @returns {BackendCapabilities}
 */
export function useBackendCapabilities() {
  // BACKEND_ENABLED is a build-time constant, so a demo build starts in its
  // final state rather than settling into it from an effect.
  const [caps, setCaps] = useState(() =>
    BACKEND_ENABLED ? UNAVAILABLE : { ...UNAVAILABLE, loaded: true },
  );

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    // A backend that is simply down must not leave the page
    // waiting: an aborted or failed check settles as "nothing available", which
    // is the same state the demo build is in permanently.
    const controller = new AbortController();
    fetch(`${BACKEND_URL}/api/health`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) =>
        setCaps({
          loaded: true,
          reachable: data !== null,
          // `?? false`: an older backend has no `sessions` field, and treating
          // absence as "yes" would put the Save button back on a server that
          // may refuse it.
          sessions: data?.sessions ?? false,
        }),
      )
      .catch(() => setCaps({ ...UNAVAILABLE, loaded: true }));
    return () => controller.abort();
  }, []);

  return caps;
}
