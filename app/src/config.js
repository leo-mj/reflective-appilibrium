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

/** @type {"dev" | "demo" | "backend"} */
export const APP_ENV = import.meta.env.VITE_APP_ENV;

/** True in dev and backend modes; false in demo. */
export const BACKEND_ENABLED = APP_ENV === "dev" || APP_ENV === "backend";

/** LLM features follow backend availability. */
export const LLM_ENABLED = BACKEND_ENABLED;

/** LLM settings modal (provider, model, API key) follows backend availability. */
export const BYOK_ENABLED = BACKEND_ENABLED;

/**
 * Relatedness-matrix tab. Currently off: the tab is hidden from the Analyze
 * tab bar, skipped in the tutorial, and its panel is never rendered.
 * `CoherenceMatrixTab.jsx`, `matrixClient.js`, and `/api/matrix/analyze`
 * remain in place — flip this to `LLM_ENABLED` to bring the tab back.
 */
export const MATRIX_ENABLED = false;

export const DEFAULT_PROVIDER = import.meta.env.VITE_DEFAULT_PROVIDER ?? "";
export const DEFAULT_MODEL = import.meta.env.VITE_DEFAULT_MODEL ?? "";
