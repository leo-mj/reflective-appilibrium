/**
 * @fileoverview Build-time feature flags.
 *
 * Two environments are supported:
 *   DEV  (vite dev)   — LLM + backend enabled; dummy data available via toggle
 *   PROD (vite build) — LLM + backend disabled; dummy data always on
 *
 * Exception: BYOK builds are PROD builds where the user supplies their own API
 * key.  Set VITE_BYOK_ENABLED=true in .env.byok to re-enable LLM + backend.
 *
 * @module config
 */

/** @type {"dev" | "prod"} */
export const APP_ENV = import.meta.env.VITE_APP_ENV;

export const BYOK_ENABLED = import.meta.env.VITE_BYOK_ENABLED === "true";

/** LLM features available in dev or when the user brings their own key. */
export const LLM_ENABLED = APP_ENV === "dev" || BYOK_ENABLED;

/** FastAPI backend available under the same conditions as LLM. */
export const BACKEND_ENABLED = APP_ENV === "dev" || BYOK_ENABLED;

export const DEFAULT_PROVIDER = import.meta.env.VITE_DEFAULT_PROVIDER ?? "";
export const DEFAULT_MODEL = import.meta.env.VITE_DEFAULT_MODEL ?? "";
