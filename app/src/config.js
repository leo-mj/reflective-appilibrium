/**
 * @fileoverview Build-time feature flags.
 *
 * Flags are set per environment in the relevant .env file:
 *   .env              — local dev  (LLM on, dummy on)
 *   .env.production   — public build (LLM off, dummy on)
 *
 * VITE_ENABLE_LLM
 *   Set to "true" to enable LLM-dependent features: chat panel and the
 *   Coherence Matrix tab.  Leave unset (or "false") for the public build
 *   so those features are absent from the bundle.
 *
 * VITE_USE_DUMMY
 *   Set to "true" to populate the Analyze / Assist tabs with pre-set example
 *   data and show the info banner that explains no live LLM is connected.
 *   Must be "true" in .env.production so the published site displays the
 *   example-driven tabs (Matrix, Suggest, Principles, Judgments) and the
 *   "no LLM connection" banner.
 *
 * @module config
 */

/** Whether LLM-dependent features are enabled in this build. */
export const LLM_ENABLED = import.meta.env.VITE_ENABLE_LLM === "true";

/**
 * Whether dummy/example data is active.  True in the public production build
 * so visitors see pre-set examples and the info banner.
 */
export const VITE_USE_DUMMY = import.meta.env.VITE_USE_DUMMY === "true";

/**
 * Whether the FastAPI backend is available.  Set to "true" in local dev;
 * leave unset (or "false") for the public SPA-only build.  Gates session
 * save/load and any other backend-only features independently of LLM access.
 */
export const BACKEND_ENABLED = import.meta.env.VITE_BACKEND_ENABLED === "true";

export const BYOK_ENABLED = import.meta.env.VITE_BYOK_ENABLED === "true";
export const DEFAULT_PROVIDER = import.meta.env.VITE_DEFAULT_PROVIDER ?? "";
export const DEFAULT_MODEL = import.meta.env.VITE_DEFAULT_MODEL ?? "";
