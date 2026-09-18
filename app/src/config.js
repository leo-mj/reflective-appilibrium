/**
 * @fileoverview Build-time feature flags.
 *
 * Three environments, set via VITE_APP_ENV:
 *   dev     (vite dev)                  — backend + LLM + BYOK enabled; sample data toggleable
 *   demo    (vite build)                — all disabled; sample data always on; publicly hosted
 *   backend (vite build --mode backend) — backend + LLM + BYOK enabled; publicly hosted
 *
 * @module config
 */

import { resolveBackendUrl } from "./backendUrl.js";

/** @type {"dev" | "demo" | "backend"} */
export const APP_ENV = import.meta.env.VITE_APP_ENV;

/** True in dev and backend modes; false in demo. */
export const BACKEND_ENABLED = APP_ENV === "dev" || APP_ENV === "backend";

/** LLM features follow backend availability. */
export const LLM_ENABLED = BACKEND_ENABLED;

/** LLM settings modal (provider, model, API key) follows backend availability. */
export const BYOK_ENABLED = BACKEND_ENABLED;

/**
 * Where every backend request goes, as a prefix for `/api/…`: an absolute URL,
 * or `""` when the backend is behind the same host as the page. What the
 * VITE_BACKEND_URL forms mean is in `backendUrl.js`. Import this rather than
 * reading the variable — that is what keeps the clients and the
 * Content-Security-Policy agreeing on one address.
 */
export const BACKEND_URL = resolveBackendUrl(import.meta.env.VITE_BACKEND_URL);

export const DEFAULT_PROVIDER = import.meta.env.VITE_DEFAULT_PROVIDER ?? "";
export const DEFAULT_MODEL = import.meta.env.VITE_DEFAULT_MODEL ?? "";

/**
 * `.env.backend` is tracked, and ships `https://<deployed-backend-url>` as a
 * reminder rather than an address. A build that picks it up is a build whose
 * every request goes to an unparsable URL — and the failure arrives as a
 * `TypeError` from `fetch`, six components deep, naming nothing. Said once at
 * load instead, where it is the first thing in the console.
 *
 * Only when a backend is expected: the demo build never reads the value, so
 * complaining about it there would be a false alarm.
 *
 * The angle brackets are the test because they are what makes the URL invalid.
 * A real host cannot contain them, so this cannot fire on a working deployment.
 */
if (BACKEND_ENABLED && /[<>]/.test(import.meta.env.VITE_BACKEND_URL ?? "")) {
  console.error(
    `[config] VITE_BACKEND_URL is still a placeholder (${import.meta.env.VITE_BACKEND_URL}). ` +
      "Every backend request from this build will fail. Set it at build time — a " +
      "variable in the environment wins over the one in app/.env.backend.",
  );
}
