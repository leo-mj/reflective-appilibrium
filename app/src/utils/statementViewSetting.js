/**
 * @fileoverview Whether the Graph tab is showing statements — the card-icon
 * switch above the zoom buttons.
 *
 * A module-level store rather than state in `Graph`, for the reason
 * `components/text_panel/cardDetails.js` is one: two places far apart in the
 * tree have to agree. The canvas draws cards by it, and the Markdown export's
 * graph follows it, being "the graph as you left it". It also outlives the
 * canvas, which is what a view preference should do.
 *
 * @module utils/statementViewSetting
 */

import { readPref, writePref } from "./storedPref.js";

const KEY = "graphStatements";

let on = readPref(KEY, false) === true;
const listeners = new Set();

/** @returns {boolean} */
export function statementViewOn() {
  return on;
}

/** @param {boolean} next */
export function setStatementViewOn(next) {
  if (next === on) return;
  on = next;
  writePref(KEY, on);
  listeners.forEach((fn) => fn());
}

/**
 * For `useSyncExternalStore`.
 *
 * @param {function(): void} fn
 * @returns {function(): void} Unsubscribes.
 */
export function subscribeStatementView(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
