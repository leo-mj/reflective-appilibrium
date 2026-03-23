/**
 * @fileoverview Build-time feature flags.
 *
 * Set VITE_ENABLE_LLM=true in .env (dev / local build) to enable LLM-dependent
 * features (chat panel, CoherenceMatrixTab).  The public production build leaves
 * this unset, so LLM code is tree-shaken out of the bundle entirely.
 *
 * @module config
 */

/** Whether LLM-dependent features are enabled in this build. */
export const LLM_ENABLED = import.meta.env.VITE_ENABLE_LLM === "true";
