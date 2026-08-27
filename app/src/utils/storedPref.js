/**
 * @fileoverview localStorage for small UI preferences, in a form that cannot
 * throw.
 *
 * Private-mode Safari denies storage outright and a full quota fails a write, so
 * every access is guarded: a preference is never worth failing a render over.
 * Both halves fall back rather than raise — a reader whose browser refuses to
 * remember their panel sizes gets the defaults, which is the state everyone
 * starts in anyway.
 *
 * @module utils/storedPref
 */

/**
 * @template T
 * @param {string} key
 * @param {T} fallback - Returned for a missing, unreadable or unparsable value.
 * @returns {T|unknown}
 */
export function readPref(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {unknown} value - JSON-serialisable.
 */
export function writePref(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* a preference is not worth failing over */
  }
}
