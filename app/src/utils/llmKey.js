/**
 * @fileoverview The BYOK settings — the one place that reads them, and the one
 * place that says they changed.
 *
 * A module-level store rather than component state, for the reason
 * {@link module:components/tour/tourWidth} is one: components nowhere near each
 * other in the tree have to agree. The settings modal writes the key; the header
 * menu labels itself with the model; every assist tab decides from it whether to
 * show live suggestions or samples. None of those can hold the value for the
 * others, and a key saved in the modal has to reach the tabs without a reload.
 *
 * `sessionStorage` stays the storage — deliberately, and see the modal for the
 * disclosure that goes with it: a key lives as long as the tab does. What this
 * module adds is a subscription over it, since storage fires no event for a
 * write from the page that owns it.
 *
 * Reads go through {@link readLLMSettings} rather than a value cached at import.
 * `getSnapshot` must return the same reference until something actually changes
 * or React re-renders forever, so the raw string is what is compared and the
 * parsed object is what is kept — which makes the store live (a write by
 * anything at all is seen) without ever re-parsing for nothing.
 *
 * @module utils/llmKey
 */

import { useSyncExternalStore } from "react";

const KEY = "llmSettings";

const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const announce = () => listeners.forEach((fn) => fn());

let lastRaw = null;
let parsed = null;

/** Returns null rather than throwing: private-mode Safari denies storage outright. */
function rawSettings() {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * The saved BYOK settings, or null if none are saved or the stored value is
 * unreadable. The same object is returned until the stored string changes, so
 * it is safe as a `useSyncExternalStore` snapshot and as an effect dependency.
 *
 * @returns {{ apiKey?: string, baseUrl?: string, model?: string }|null}
 */
export function readLLMSettings() {
  const raw = rawSettings();
  if (raw === lastRaw) return parsed;
  lastRaw = raw;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  return parsed;
}

/**
 * Whether a key the backend can actually use is saved. A settings object with a
 * model but no `apiKey` is not one — that is what a cleared key leaves behind.
 *
 * @returns {boolean}
 */
export function hasLLMKey() {
  return Boolean(readLLMSettings()?.apiKey);
}

/**
 * Tells every subscriber the settings moved. Called by whatever wrote them —
 * `sessionStorage` raises no event for a write from the page that made it, so
 * without this the header still names the old model and the assist tabs still
 * serve samples until something else happens to re-render them.
 */
export function notifyLLMKeyChanged() {
  announce();
}

/** The saved settings, re-rendering the caller when they change. */
export function useLLMSettings() {
  return useSyncExternalStore(subscribe, readLLMSettings, readLLMSettings);
}

/** Whether a usable key is saved, re-rendering the caller when that flips. */
export function useHasLLMKey() {
  return useSyncExternalStore(subscribe, hasLLMKey, hasLLMKey);
}

// ── Asking for the modal ─────────────────────────────────────────────────────
//
// The modal belongs to the header, and the tabs that need it are six levels
// below and on the other side of the layout. A counter both headers watch is
// what lets a tab say "the reader needs to set a key" without its `open` state
// being lifted through every component in between — and a counter rather than a
// boolean because the second ask has to open the modal again after the first was
// dismissed, which a flag already at `true` cannot express.

let requests = 0;

/** Asks whichever header is mounted to open the LLM settings modal. */
export function requestLLMSettings() {
  requests += 1;
  announce();
}

/**
 * A number that increases each time {@link requestLLMSettings} is called. A
 * header opens its modal when the value it last saw changes; the value itself
 * means nothing.
 */
export function useLLMSettingsRequested() {
  return useSyncExternalStore(
    subscribe,
    () => requests,
    () => 0,
  );
}
