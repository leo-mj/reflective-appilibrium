/**
 * @fileoverview Explanations for disabled suggestion controls.
 * @module utils/disabledReason
 */

/**
 * Why a suggestion control cannot be used right now.
 *
 * A disabled button with no explanation is a dead end. The banner at the top of
 * the page states the backend case once, far from the control the user just
 * tried to press; this puts the reason on the control itself, where it reaches
 * both a hovering pointer and a screen reader.
 *
 * Returns `undefined` when the control is live, so it can go straight onto
 * `title` without a conditional at the call site.
 *
 * @param {Object} opts
 * @param {boolean} [opts.loading]   - A request is already in flight.
 * @param {boolean} [opts.noBackend] - No LLM is reachable in this build.
 * @param {string}  [opts.needs]     - Unmet precondition, phrased as an
 *   instruction, e.g. "Add at least two elements first."
 * @returns {string|undefined}
 */
export function suggestionsUnavailable({ loading, noBackend, needs } = {}) {
  // Ordered by what the user can do about it: nothing, nothing, something.
  if (loading) return "Working on the last request…";
  if (noBackend)
    return "AI suggestions need a backend, which this build does not have. The sample process shows recorded suggestions instead.";
  if (needs) return needs;
  return undefined;
}
