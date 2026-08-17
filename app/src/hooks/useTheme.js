/**
 * @fileoverview Viewing mode — dark/light theme, and the accessible palette.
 *
 * A module-level store rather than component state. Three separate components
 * call `useTheme` (both headers and the landing page), and the node palette now
 * depends on it, so every reader has to see the same value and re-render when it
 * changes. With `useState` in each caller they each held their own copy, kept
 * roughly in step only because they re-read the DOM on mount.
 *
 * @module hooks/useTheme
 */

import { useSyncExternalStore } from "react";
import { resolvePalette } from "../constants/palettes.js";

const THEME_KEY = "theme";
const ACCESSIBLE_KEY = "accessibleColors";

/** localStorage throws in private-mode Safari; a missing preference is not fatal. */
function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* preference is not worth failing a render over */
  }
}

/**
 * The mode lives on `<html>`, not in this module.
 *
 * `data-theme` is already the truth as far as CSS is concerned, and the boot
 * script sets it before React runs. Mirroring it in a variable would give two
 * representations to keep in step, and they would drift — anything that sets the
 * attribute directly (the boot script, a test) would be invisible. So the
 * attributes are read on every snapshot instead.
 */
// Guarded because this module is imported transitively by render helpers that
// some suites exercise in a bare node environment. Without a document there is
// nothing to read and nothing to paint, so the defaults stand in.
const hasDom = typeof document !== "undefined";
const root = () => document.documentElement;
const readMode = () =>
  hasDom
    ? {
        isDark: root().getAttribute("data-theme") !== "light",
        accessible: root().getAttribute("data-contrast") === "high",
      }
    : { isDark: true, accessible: false };

/**
 * Cached snapshot. `useSyncExternalStore` compares by identity and loops forever
 * if handed a fresh object each call, so a new one is minted only when the mode
 * actually differs.
 */
let state = readMode();

const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  const next = readMode();
  if (next.isDark !== state.isDark || next.accessible !== state.accessible) state = next;
  return state;
}

// Restore the saved preference. The theme's own boot script handles `data-theme`
// before first paint; this one has no flash to avoid, since it only re-tints
// nodes that have not been drawn yet.
if (hasDom && readStored(ACCESSIBLE_KEY) === "true") {
  root().setAttribute("data-contrast", "high");
  state = readMode();
}

function announce() {
  getSnapshot();
  for (const listener of listeners) listener();
}

/**
 * @returns {{
 *   isDark: boolean,
 *   accessible: boolean,
 *   toggle: () => void,
 *   toggleAccessible: () => void,
 * }}
 */
export function useTheme() {
  const { isDark, accessible } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { isDark, accessible, toggle, toggleAccessible };
}

/** Switch between the dark and light themes. */
export function toggle() {
  const nextDark = !state.isDark;
  if (nextDark) root().removeAttribute("data-theme");
  else root().setAttribute("data-theme", "light");
  store(THEME_KEY, nextDark ? "dark" : "light");
  announce();
}

/** Turn the high-contrast node palette on or off. */
export function toggleAccessible() {
  const next = !state.accessible;
  if (next) root().setAttribute("data-contrast", "high");
  else root().removeAttribute("data-contrast");
  store(ACCESSIBLE_KEY, String(next));
  announce();
}

/**
 * The node palette in force, as a hook.
 *
 * Components that draw nodes call this rather than reaching for the fills
 * directly — the palette is theme-dependent now, so a component that imports a
 * hex is a component that will be wrong in one of the three modes.
 *
 * @returns {import('../constants/palettes.js').Palette}
 */
export function usePalette() {
  const { accessible } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return resolvePalette(accessible);
}
