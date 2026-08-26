/**
 * @fileoverview How wide the wide tour's column is, and whether it is being
 * dragged right now.
 *
 * A module-level store rather than component state, for the reason `useTheme`
 * is one: two components that are nowhere near each other in the tree have to
 * agree on this number. The tour draws itself at it, and the app pads itself by
 * it — a tour that took 520px while the app made room for 460 would sit over
 * the controls it is pointing at.
 *
 * The drag flag is here for the same reason. The app eases its padding when the
 * tour opens and closes, which is right for a panel appearing and wrong for one
 * being dragged: the column would follow the pointer while the app trailed a
 * third of a second behind it. Whoever is animating has to know, and that is
 * not the component doing the dragging.
 *
 * Only the column resizes. The narrow layout's sheet has two heights and a
 * handle to swap between them, which is a deliberate choice rather than a
 * missing feature — see {@link module:components/tour/tourZ.TOUR_SHEET}.
 *
 * @module components/tour/tourWidth
 */

import { useSyncExternalStore } from "react";

import { readPref, writePref } from "../../utils/storedPref.js";
import { TOUR_W } from "./tourZ.js";

const KEY = "tourWidth";

/** Narrower than this and the prose is a column of two-word lines. */
export const TOUR_MIN_W = 320;
/** Wider and the tour is the app, rather than something beside it. */
export const TOUR_MAX_W = 720;

/**
 * Clamped against the window as well as the two constants: a width remembered
 * from a large monitor must not swallow a laptop's screen, and the tour is only
 * ever offered where there is a graph beside it to look at.
 */
function clamp(w) {
  const room =
    typeof window === "undefined"
      ? TOUR_MAX_W
      : Math.max(TOUR_MIN_W, window.innerWidth - 360);
  return Math.round(Math.max(TOUR_MIN_W, Math.min(w, TOUR_MAX_W, room)));
}

const stored = readPref(KEY, TOUR_W);
let width = clamp(typeof stored === "number" && stored > 0 ? stored : TOUR_W);
let resizing = false;

const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const announce = () => listeners.forEach((fn) => fn());

/** Sets the width without recording it: for the frames of a drag. */
export function setTourWidth(next) {
  const w = clamp(next);
  if (w === width) return;
  width = w;
  announce();
}

/** Writes down where the drag left it. Called once, at the end of one. */
export function storeTourWidth() {
  writePref(KEY, width);
}

/** Back to the width it ships at, and remembered as the reader's choice. */
export function resetTourWidth() {
  setTourWidth(TOUR_W);
  storeTourWidth();
}

/** Whether a drag is in progress, so anything animating can stand aside. */
export function setTourResizing(next) {
  if (resizing === next) return;
  resizing = next;
  announce();
}

export function useTourWidth() {
  return useSyncExternalStore(
    subscribe,
    () => width,
    () => width,
  );
}

export function useTourResizing() {
  return useSyncExternalStore(
    subscribe,
    () => resizing,
    () => false,
  );
}
