/**
 * @fileoverview Pure state-manipulation helpers shared across components.
 *
 * All functions are stateless and have no React dependencies.
 *
 * @module utils/stateUtils
 */

/** @import { REElement, RERelation, RELogEntry, REHistoryEvent } from '../types.js' */

// ─── Item history ─────────────────────────────────────────────────────────────
//
// Everything that has happened to an element or relation lives in one
// chronological `history` list. The fields alongside it — `status`, `text`,
// `previousText`, `reason` — are that list projected onto "now"; `asOfRound`
// projects it onto any earlier round, which is what history playback needs.

/** The wording payload field, holding element text or relation explanation. */
const WORDING = "previousText";

/**
 * Rebuilds a history list from the scalar fields older states used: a single
 * `withdrawnRound`/`reinstatedRound`, `revisedRound` with one `previousText`,
 * `rejectedRound`, and the short-lived `withdrawals` interval list.
 *
 * @param {REElement|RERelation} item
 * @returns {REHistoryEvent[]}
 */
function legacyHistory(item) {
  const events = [];
  if (item.revisedRound) {
    events.push({
      round: item.revisedRound,
      type: "revised",
      ...(item.previousText != null && { [WORDING]: item.previousText }),
    });
  }
  if (item.rejectedRound)
    events.push({ round: item.rejectedRound, type: "rejected" });

  const periods = Array.isArray(item.withdrawals)
    ? item.withdrawals
    : item.withdrawnRound
      ? [{ from: item.withdrawnRound, to: item.reinstatedRound }]
      : [];
  periods.forEach((p, i) => {
    // `reason` described the most recent withdrawal only, so it belongs there.
    const isLast = i === periods.length - 1;
    events.push({
      round: p.from,
      type: "withdrawn",
      ...(isLast && item.reason ? { reason: item.reason } : {}),
    });
    if (p.to != null) events.push({ round: p.to, type: "reinstated" });
  });

  return events.sort((a, b) => a.round - b.round);
}

/**
 * An item's history, migrating older shapes on read so saved states keep working.
 *
 * @param {REElement|RERelation} item
 * @returns {REHistoryEvent[]}
 */
export function historyOf(item) {
  if (Array.isArray(item?.history)) return item.history;
  return item ? legacyHistory(item) : [];
}

/**
 * The item's history with `event` appended. Every action bumps the round first,
 * so appending keeps the list ordered.
 *
 * @param {REElement|RERelation} item
 * @param {REHistoryEvent} event
 * @returns {REHistoryEvent[]}
 */
export function withEvent(item, event) {
  return [...historyOf(item), event];
}

/**
 * Folds history up to and including `round` into the fields it determines.
 * Events are half-open in effect: an item withdrawn in round 3 and reinstated in
 * round 6 was absent for 3, 4 and 5, and present again from 6.
 *
 * @param {REElement|RERelation} item
 * @param {number} round
 * @returns {{ status: string, previousText: string|undefined, reason: string|undefined, pendingWording: string|undefined }}
 */
function foldHistory(item, round) {
  let status = "active";
  let revised = false;
  let previousText;
  let reason;
  // The wording restored by the first revision *after* `round` — i.e. what the
  // item actually read at `round`.
  let pendingWording;

  for (const ev of historyOf(item)) {
    if (ev.round > round) {
      if (pendingWording === undefined && ev.type === "revised")
        pendingWording = ev[WORDING];
      continue;
    }
    switch (ev.type) {
      case "withdrawn":
        status = "withdrawn";
        reason = ev.reason;
        break;
      case "rejected":
        status = "rejected";
        break;
      case "reinstated":
        status = revised ? "revised" : "active";
        reason = undefined;
        break;
      case "revised":
        revised = true;
        previousText = ev[WORDING];
        if (status === "active") status = "revised";
        break;
    }
  }
  return { status, previousText, reason, pendingWording };
}

/**
 * Whether the item was withdrawn as of `round`.
 *
 * @param {REElement|RERelation} item
 * @param {number} round
 * @returns {boolean}
 */
export function isWithdrawnAt(item, round) {
  return foldHistory(item, round).status === "withdrawn";
}

/**
 * Whether the item is withdrawn right now.
 *
 * @param {REElement|RERelation} item
 * @returns {boolean}
 */
export function isWithdrawnNow(item) {
  const events = historyOf(item).filter(
    (e) => e.type === "withdrawn" || e.type === "reinstated",
  );
  return events.at(-1)?.type === "withdrawn";
}

/**
 * The item's wording as of `round` — its text, or a relation's explanation.
 * Each revision stores the wording it replaced, so the text at some earlier
 * round is the `previousText` of the first revision after it.
 *
 * @param {REElement|RERelation} item
 * @param {number} round
 * @returns {string}
 */
export function textAtRound(item, round) {
  const { pendingWording } = foldHistory(item, round);
  const current = item.text ?? item.explanation;
  return pendingWording ?? current;
}

/** Statuses that come from an event, and so can be dated. */
const DATED_STATUSES = new Set(["withdrawn", "rejected", "revised"]);

/**
 * The round in which the item took on the status it is showing.
 *
 * Bounded by `round` so history playback dates a status by the event in force
 * then, not by a later one: an item withdrawn in round 2, reinstated in 4 and
 * withdrawn again in 6 reads as withdrawn since 2 when viewing round 3.
 *
 * @param {REElement|RERelation} item
 * @param {number} [round] - The round being viewed. Defaults to the whole history.
 * @returns {number|undefined} Undefined for a status nothing recorded.
 */
export function statusRound(item, round = Infinity) {
  if (!DATED_STATUSES.has(item?.status)) return undefined;
  let found;
  for (const ev of historyOf(item)) {
    if (ev.round > round) break;
    if (ev.type === item.status) found = ev.round;
  }
  return found;
}

/**
 * The item as it stood at `round`: status, wording, and the withdrawal reason
 * and previous wording that were showing then. Returns the same object when
 * nothing differs, so React sees no spurious change.
 *
 * @template {REElement|RERelation} T
 * @param {T} item
 * @param {number} round
 * @returns {T}
 */
export function asOfRound(item, round) {
  const events = historyOf(item);
  // Nothing recorded — `possible` and never-touched items keep what they have.
  if (!events.length) return item;

  const { status, previousText, reason, pendingWording } = foldHistory(
    item,
    round,
  );
  const wordingField = item.text !== undefined ? "text" : "explanation";
  const wording = pendingWording ?? item[wordingField];

  if (
    status === item.status &&
    wording === item[wordingField] &&
    previousText === item.previousText &&
    reason === item.reason
  )
    return item;

  const next = { ...item, status, [wordingField]: wording };
  if (previousText === undefined) delete next.previousText;
  else next.previousText = previousText;
  if (reason === undefined) delete next.reason;
  else next.reason = reason;
  return next;
}

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

  const active = elements.filter((e) => addedBy(e) && !isWithdrawnAt(e, round));
  const withdrawn = elements.filter((e) => addedBy(e) && isWithdrawnAt(e, round));
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
    // Items are projected back to `round`, so anything reading their fields
    // directly — the text tab's strikethrough, its wording, the graph's edge
    // styling — shows the state of play then rather than now.
    elements: elements.map((e) => asOfRound(e, round)),
    relations: state.relations
      .filter(
        (r) =>
          visIds.has(r.from) && visIds.has(r.to) && (r.addedRound || 1) <= round,
      )
      .map((r) => asOfRound(r, round)),
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
 * Elements a new relation or argument may be built from — everything except
 * `possible`, which the user has not affirmed yet.
 *
 * Withdrawn and rejected elements deliberately stay eligible: a new argument is
 * how one earns a second look, and being referenced never changes an element's
 * status. Reinstating it is a separate, explicit decision.
 *
 * @param {REElement[]} elements
 * @returns {REElement[]}
 */
export function linkableElements(elements) {
  return elements.filter((e) => e.status !== "possible");
}

/**
 * Sorted ids to seed a picker's initial selection from. Every linkable element
 * stays *selectable*, but a form should open on something currently in play
 * rather than on whichever withdrawn element happens to sort first.
 *
 * @param {REElement[]} elements
 * @returns {string[]}
 */
export function defaultPickerIds(elements) {
  const inPlay = elements.filter(
    (e) => e.status !== "withdrawn" && e.status !== "rejected",
  );
  return (inPlay.length ? inPlay : elements)
    .map((e) => e.id)
    .sort(sortElementIds);
}

/**
 * Generates the id shared by every relation belonging to one argument. Joint
 * arguments are grouped by it when rendering, selecting, and deleting.
 *
 * @returns {string}
 */
export function newArgumentId() {
  return `arg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

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
