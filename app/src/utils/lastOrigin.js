/**
 * @fileoverview What the origin field is filled in with, kept for next time.
 *
 * `origin` records who introduced an element, and the answer is the same for
 * every element one person adds in a sitting — a participant id, a session
 * label, a model name they are transcribing from. The three forms that offer
 * the field each held their own copy of it, reset to `"user"` whenever the form
 * was cleared, submitted, or unmounted by a tab change, so anyone whose answer
 * was not `"user"` retyped it for every element they added.
 *
 * A module-level store rather than state lifted into `REState`, for the reason
 * `tourWidth` is one: the three forms are nowhere near each other in the tree —
 * the add bar under the text panel, the assist tabs' own panel, the graph's
 * modal — and two of them can be on screen at once, where typing in one and
 * seeing the other disagree would read as a fault. `useSyncExternalStore` is
 * what keeps them in step.
 *
 * It is a preference and not part of the state file: it says how *this reader*
 * fills the field in, not what any element's origin is, so it goes to
 * localStorage beside the panel sizes and survives a reload the way they do.
 * Elements already added keep whatever origin they were added with; changing an
 * element's origin from the edit modal is a change to that element and
 * deliberately does not come back here.
 *
 * @module utils/lastOrigin
 */

import { useSyncExternalStore } from "react";

import { readPref, writePref } from "./storedPref.js";

const KEY = "lastOrigin";

/** What the field ships filled in with, and what an empty stored value means. */
export const DEFAULT_ORIGIN = "user";

const stored = readPref(KEY, DEFAULT_ORIGIN);
let origin = typeof stored === "string" ? stored : DEFAULT_ORIGIN;

const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/**
 * Records what the reader typed. Called on every keystroke, so it writes only
 * when the value has actually moved.
 *
 * The empty string is kept as typed rather than corrected to `"user"`: someone
 * clearing the field is midway through replacing it, and a default reappearing
 * under the cursor is worse than a field that is briefly blank. What is
 * submitted from an empty field is the caller's business — see
 * {@link originOrDefault}.
 *
 * @param {string} next
 */
export function setLastOrigin(next) {
  if (next === origin) return;
  origin = next;
  writePref(KEY, origin);
  listeners.forEach((fn) => fn());
}

/** @returns {string} */
export function lastOrigin() {
  return origin;
}

/**
 * The origin an element is actually added with. A field left empty is not an
 * element with no origin — nothing downstream reads one — so it falls back to
 * the default rather than writing a blank into the state file.
 *
 * @param {string} value
 * @returns {string}
 */
export const originOrDefault = (value) => value.trim() || DEFAULT_ORIGIN;

/** Subscribes a form to the shared value. @returns {string} */
export function useLastOrigin() {
  return useSyncExternalStore(subscribe, lastOrigin, lastOrigin);
}
