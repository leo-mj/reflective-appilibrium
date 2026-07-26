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

/**
 * Set of relation types that represent logical arguments (entailment or preclusion).
 * Used to filter argument relations from the full relation list.
 *
 * @type {Set<string>}
 */
export const ARGUMENT_RELATION_TYPES = new Set([
  "entails",
  "precludes",
  "jointly_entails",
  "jointly_precludes",
]);

/**
 * Returns the relation type for an argument based on premise count and
 * whether the conclusion is negated.
 *
 * @param {number}  premiseCount
 * @param {boolean} negated
 * @returns {'entails'|'precludes'|'jointly_entails'|'jointly_precludes'}
 */
export function argumentRelationType(premiseCount, negated) {
  return premiseCount === 1
    ? (negated ? "precludes" : "entails")
    : (negated ? "jointly_precludes" : "jointly_entails");
}

/**
 * Composes a relation explanation from the meaning postulates an argument
 * relies on. Postulates verify the inference (they are true in virtue of the
 * sentences' meanings) but are kept out of the element pool; folding their
 * texts into the created relation's explanation keeps the inferential bridge
 * visible so the user can contest it later.
 *
 * @param {string[]} [postulates] - Meaning-postulate texts for one argument.
 * @returns {string} `"Valid given: …"`, or `""` when there are no postulates.
 */
export function argumentPostulateExplanation(postulates) {
  if (!postulates || postulates.length === 0) return "";
  return `Valid given: ${postulates.join(" ")}`;
}

/**
 * Human-readable label for a relation type. The stored identifier stays
 * `"depends"` (used as a color key, in the backend schema, and in saved
 * state); only the user-facing wording reads "depends on" so edges render as
 * "A depends on B".
 *
 * @param {string} type - Relation type identifier.
 * @returns {string}
 */
export function relationTypeLabel(type) {
  return type === "depends" ? "depends on" : type;
}

// ─── Origin helpers ───────────────────────────────────────────────────────────

/**
 * Marks an element's `origin` as also user-edited, unless it already says so.
 * Used when an LLM suggestion is modified before acceptance, or when a
 * previously LLM-authored element is later revised by the user.
 *
 * @param {string} origin - The element's current origin, e.g. `"LLM"` or a model name.
 * @returns {string} e.g. `"LLM+user"`; unchanged if already user-attributed.
 */
export function withUserEdit(origin) {
  if (!origin || origin.includes("user")) return origin;
  return `${origin} & user`;
}

/** Fallback origin for an LLM suggestion when the specific model is unknown. */
export const LLM_ORIGIN = "LLM";

/**
 * Origin for an accepted LLM suggestion: the specific model name when known
 * (e.g. `"gpt-4o"`), else the generic `"LLM"` fallback — plus `"+user"` if
 * the user edited the suggestion's text before accepting it.
 *
 * @param {boolean} wasEdited
 * @param {string} [model] - The model that produced the suggestion, if known.
 * @returns {string}
 */
export function llmOrigin(wasEdited, model) {
  const base = model || LLM_ORIGIN;
  return wasEdited ? withUserEdit(base) : base;
}
