/**
 * @fileoverview Keeps the working RE state in localStorage so that closing the
 * tab is not the same as throwing the session away.
 *
 * Until now the state lived only in React state: a refresh, a crash, or a
 * mis-click on the close button lost the whole process. That matters most in
 * exactly the configurations that have no server to fall back on — the demo
 * build, and any hosted instance, where session storage is off by design.
 *
 * localStorage rather than sessionStorage because sessionStorage is cleared
 * when the tab closes, which is the case this exists to survive.
 *
 * This is a safety net, not a filing cabinet: one draft, overwritten as you
 * work. Keeping several named sessions is what Export and the server store are
 * for.
 *
 * @module utils/draftStorage
 */

/** @import { REState } from '../types.js' */

import { validateState } from "./importMarkdown.js";

const KEY = "reDraft";

/** Rough ceiling on what we will try to store, well inside a 5 MB quota. */
const MAX_DRAFT_BYTES = 2_000_000;

/**
 * @typedef {Object} Draft
 * @property {REState} state
 * @property {string}  savedAt  ISO 8601 timestamp.
 */

/**
 * Writes the current state over the previous draft.
 *
 * Never throws: autosave runs on a timer behind the user's work, so a storage
 * failure has to degrade to "no draft" rather than interrupt them. Private
 * browsing modes deny localStorage outright, and a large enough state can
 * exceed the quota.
 *
 * @param {REState} state
 * @returns {boolean} Whether the draft was stored.
 */
export function saveDraft(state) {
  try {
    const payload = JSON.stringify({ state, savedAt: new Date().toISOString() });
    if (payload.length > MAX_DRAFT_BYTES) return false;
    localStorage.setItem(KEY, payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the stored draft, or null if there is none we can use.
 *
 * The state is put through the file importer's validator: a draft written by an
 * older version of the app is untrusted input by the time a newer one reads it,
 * and a stale shape should be discarded rather than crash the page it loads
 * into. Anything unreadable is dropped on the spot so it cannot fail twice.
 *
 * @returns {Draft|null}
 */
export function loadDraft() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const { state, savedAt } = JSON.parse(raw);
    return { state: validateState(state), savedAt };
  } catch {
    clearDraft();
    return null;
  }
}

/** Removes the stored draft, if any. */
export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do: no storage means no draft to remove.
  }
}

/**
 * True when a draft holds enough work to be worth offering back.
 *
 * An untouched starting state is not worth a "resume?" prompt on every visit.
 *
 * @param {Draft|null} draft
 * @returns {boolean}
 */
export function isWorthResuming(draft) {
  return Boolean(draft?.state?.elements?.length);
}
