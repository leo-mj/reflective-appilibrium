/**
 * @fileoverview Pinned node positions — where the reader has dragged elements
 * on the graph. `state.pins`, `{ [elementId]: { x, y } }`.
 *
 * A view device, as a group is: pinning does not advance the round, does not
 * appear in the log, does not enter the coherence analysis, and is not an undo
 * step. It lives on the state so that the export's `re-state` block, the
 * autosave and Import carry it.
 *
 * **Offsets from the layout's centre, not canvas coordinates.** The simulation
 * centres on the graph panel, whose size is the reader's window; stored as
 * offsets, a file opened in a different window keeps its shape.
 *
 * @module utils/pinUtils
 */

/** @import { REState } from '../types.js' */

/**
 * A state's pins, defaulting to none. Read through this rather than
 * `state.pins`, which is absent until something is pinned.
 *
 * @param {REState} [state]
 * @returns {Record<string, {x: number, y: number}>}
 */
export function pinsOf(state) {
  return state?.pins ?? {};
}

/**
 * The state with `updates` pinned over its existing pins. Pins for elements
 * the state no longer holds are dropped on the way, since a later element may
 * be given the id again.
 *
 * @param {REState} state
 * @param {Record<string, {x: number, y: number}>} updates
 * @returns {REState}
 */
export function withPins(state, updates) {
  const ids = new Set(state.elements.map((e) => e.id));
  const pins = {};
  for (const [id, p] of Object.entries({ ...pinsOf(state), ...updates }))
    if (ids.has(id)) pins[id] = p;
  return { ...state, pins };
}

/**
 * The state with the named elements unpinned. Returns the state itself when
 * none of them were pinned, so a caller can tell nothing changed.
 *
 * @param {REState} state
 * @param {Iterable<string>} ids
 * @returns {REState}
 */
export function withoutPins(state, ids) {
  const pins = { ...pinsOf(state) };
  let changed = false;
  for (const id of ids) {
    if (id in pins) {
      delete pins[id];
      changed = true;
    }
  }
  return changed ? { ...state, pins } : state;
}

/**
 * True when the two states differ in their pins and nothing else — which is
 * what the one undoable pin change, Reset layout, leaves between its before
 * and after. Compared by identity, as every edit replaces what it touches.
 *
 * @param {REState} a
 * @param {REState} b
 */
function onlyPinsDiffer(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete("pins");
  return [...keys].every((k) => a[k] === b[k]);
}

/**
 * `target` carrying `source`'s pins. Undo and redo move between whole states,
 * and a drag is not an undo step: undoing an edit must not also undo the drags
 * made since. The exception is a step that changed nothing but the pins —
 * Reset layout — which undo is there to take back.
 *
 * @param {REState} target
 * @param {REState} source
 * @returns {REState}
 */
export function carryPins(target, source) {
  if (target.pins === source.pins || onlyPinsDiffer(target, source))
    return target;
  const { pins: _dropped, ...rest } = target;
  return source.pins === undefined ? rest : { ...rest, pins: source.pins };
}
