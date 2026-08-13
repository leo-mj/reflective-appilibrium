/**
 * @fileoverview Writes the working state to localStorage as it changes.
 * @module hooks/useAutosaveDraft
 */

import { useEffect, useRef } from "react";
import { saveDraft } from "../utils/draftStorage.js";

/** How long the state must sit still before it is written. */
const DEBOUNCE_MS = 800;

/**
 * Persists `state` to the local draft, debounced.
 *
 * Debounced because a state change is not a keystroke but it is not rare
 * either — dragging a confidence slider produces a burst — and serialising a
 * large graph on each one would be felt. The trailing write always happens, so
 * the draft is at most DEBOUNCE_MS behind.
 *
 * The timer is also flushed on unmount and on `pagehide`. `pagehide` rather
 * than `beforeunload`: it fires for the cases that actually lose work on mobile
 * — the tab being backgrounded and then discarded — where `beforeunload` may
 * never run at all.
 *
 * @param {import('../types.js').REState} state
 * @param {boolean} [enabled=true]  False for states not worth keeping, like the
 *   read-only sample process.
 */
export function useAutosaveDraft(state, enabled = true) {
  // The debounce closes over `state` directly. The ref exists only for the
  // flush paths, which fire on events rather than on a state change and so have
  // no `state` of their own to read. Assigned in an effect, not during render:
  // a ref written while rendering is not guaranteed to survive a discarded one.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => saveDraft(state), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const flush = () => saveDraft(latest.current);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      // Leaving the editor is itself a moment worth capturing: the debounce may
      // still be pending, and the component is about to stop existing.
      flush();
    };
  }, [enabled]);
}
