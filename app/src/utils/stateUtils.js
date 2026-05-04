/**
 * @fileoverview Pure state-manipulation helpers shared across components.
 *
 * All functions are stateless and have no React dependencies.
 *
 * @module utils/stateUtils
 */

/** @import { REElement, RERelation, RELogEntry } from '../types.js' */

// ─── Round filtering ──────────────────────────────────────────────────────────

/**
 * Returns the elements visible at a given round, split into active and withdrawn.
 *
 * An element is **active** at `round` if it was added by that round and not yet
 * withdrawn.  An element is **withdrawn** at `round` if it was added and then
 * withdrawn by that round.  Elements not yet added are excluded from both lists.
 *
 * Used by both {@link module:components/HistoryTab} and the `textState` computation
 * in {@link module:components/REState}.
 *
 * @param {REElement[]} elements - All elements across all rounds.
 * @param {number}      round    - The round to filter to.
 * @returns {{ active: REElement[], withdrawn: REElement[] }}
 */
export function elementsAtRound(elements, round) {
  const addedBy = (e) => (e.addedRound || 1) <= round;
  const withdrawnBy = (e) =>
    e.status === "withdrawn" && e.withdrawnRound && e.withdrawnRound <= round;

  const active = elements.filter((e) => addedBy(e) && !withdrawnBy(e));
  const withdrawn = elements.filter((e) => addedBy(e) && withdrawnBy(e));
  return { active, withdrawn };
}

// ─── Element ID generation ────────────────────────────────────────────────────

/** Maps element type to its ID prefix character. */
const TYPE_PREFIX = { judgment: "J", principle: "P", theory: "T" };

/**
 * Generates the next available ID for a new element of the given type.
 *
 * Scans existing element IDs for the matching prefix and returns
 * `"<prefix><max + 1>"`, or `"<prefix>1"` if none exist yet.
 *
 * @param {REElement[]} elements - All existing elements.
 * @param {string}      type     - Element type ('judgment' | 'principle' | 'theory').
 * @returns {string} New element ID, e.g. `"J13"`.
 */
export function nextElementId(elements, type) {
  const prefix = TYPE_PREFIX[type] ?? "J";
  const nums = elements
    .filter((e) => e.id.startsWith(prefix))
    .map((e) => parseInt(e.id.slice(prefix.length)))
    .filter((n) => !isNaN(n));
  return `${prefix}${nums.length > 0 ? Math.max(...nums) + 1 : 1}`;
}

// ─── Log helpers ──────────────────────────────────────────────────────────────

/**
 * Computes a human-readable diff string for a set of fields between two objects.
 *
 * Only fields whose values differ are included.  Returns an empty array when
 * nothing changed (the caller should substitute a fallback label).
 *
 * @param {string[]} fields - Field names to compare.
 * @param {Object}   oldObj - Original object.
 * @param {Object}   newObj - Updated object.
 * @returns {string[]} Array of `"field: old → new"` strings.
 */
export function makeDiff(fields, oldObj, newObj) {
  return fields
    .filter((k) => oldObj[k] !== newObj[k])
    .map((k) => `${k}: ${oldObj[k]} → ${newObj[k]}`);
}

/**
 * Constructs a round log entry object.
 *
 * @param {number} round    - Round number this entry documents.
 * @param {string} findings - Observation or reason for the change.
 * @param {string} decision - Short label for what was done (e.g. `"Added"`).
 * @param {string} changes  - Human-readable summary of the change.
 * @returns {RELogEntry}
 */
export function makeLogEntry(round, findings, decision, changes) {
  return { round, findings, options: "", decision, changes };
}

/** @import { REState } from '../types.js' */

/**
 * Returns a filtered view of `state` containing only elements and relations
 * that existed at the given round. Used to sync the TextTab with the history slider.
 *
 * @param {REState} state
 * @param {number}  round
 * @returns {REState}
 */
export function stateAtRound(state, round) {
  const { active, withdrawn } = elementsAtRound(state.elements, round);
  const elements = [...active, ...withdrawn];
  const visIds = new Set(elements.map((e) => e.id));
  return {
    ...state,
    round,
    elements,
    relations: state.relations.filter(
      (r) =>
        visIds.has(r.from) && visIds.has(r.to) && (r.addedRound || 1) <= round,
    ),
  };
}

/**
 * Helps compare element IDs for sorting.
 *
 * @param {string} id1 - An element ID consisting of J, P, or T and a number string.
 * @param {string} id2 - An element ID consisting of J, P, or T and a number string.
 * @returns {number} - A number value indicating which element ID comes first.
 */
export function sortElementIds(id1, id2) {
  const typeOrder = {
    J: 0,
    P: 1,
    T: 2,
  };
  const [elTypeAbbreviation1, elTypeAbbreviation2] = [id1[0], id2[0]];
  if (elTypeAbbreviation1 !== elTypeAbbreviation2) {
    const t1 = typeOrder[elTypeAbbreviation1] ?? 99;
    const t2 = typeOrder[elTypeAbbreviation2] ?? 99;
    return t1 - t2;
  }
  const [elNumber1, elNumber2] = [id1.slice(1), id2.slice(1)];
  return Number(elNumber1) - Number(elNumber2);
}
