/**
 * @fileoverview Whether the text panel's cards are showing their stats.
 *
 * One answer for the whole panel, not one per card. "Hide details" is a reader
 * saying how they want to read a *list* — claims only, or claims with everything
 * said about them — and a fold that applied to the card under the pointer left
 * them pressing it two dozen times to get either.
 *
 * A module-level store rather than state in `TextTab`, for the reason
 * `tourWidth` is one: the cards are spread across the panel's sections, the
 * cluster cards among them, and every one of them has to agree. It also outlives
 * the panel, which is what a view preference should do — switching to the graph
 * and back is not an instruction to unfold everything again.
 *
 * @module components/text_panel/cardDetails
 */

import { useSyncExternalStore } from "react";

import { readPref, writePref } from "../../utils/storedPref.js";

const KEY = "cardDetails";

/** Shown until the reader says otherwise: the stats are most of what a card says. */
const DEFAULT = true;

const stored = readPref(KEY, DEFAULT);
let shown = typeof stored === "boolean" ? stored : DEFAULT;

const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** @param {boolean} next */
export function setCardDetails(next) {
  if (next === shown) return;
  shown = next;
  writePref(KEY, shown);
  listeners.forEach((fn) => fn());
}

/** @returns {boolean} */
export function useCardDetails() {
  return useSyncExternalStore(
    subscribe,
    () => shown,
    () => shown,
  );
}
