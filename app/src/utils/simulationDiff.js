/**
 * @fileoverview What a rethon simulation changes, said as changes.
 *
 * A simulation comes back as its evolution — every position it passed through,
 * commitments at even indices and theories at odd ones, each a full list of
 * elements. Read as lists, every step repeated nearly everything in the one
 * before it, and the reader had to find the difference themselves. These
 * functions do that: what a step brought in and dropped, and what accepting a
 * position would do to the process as it stands.
 *
 * One reading throughout, so the Simulate tab's lists, the graph's preview and
 * what Accept applies cannot disagree: an element is **held** at a step when
 * the commitments or the theory then in force contain it, and **rejected** when
 * the commitments hold its negation.
 *
 * @module utils/simulationDiff
 */

import { ARGUMENT_RELATION_TYPES } from "./stateUtils.js";

/** Theory steps sit at odd indices of the evolution, commitments at even. */
export const stepKind = (index) => (index % 2 === 0 ? "commitments" : "theory");

/** An entry of a position: its id, marked when the position holds its negation. */
const entryKey = (e) => (e.negated ? `¬${e.id}` : e.id);

/**
 * What is held and rejected at a point in the evolution: the commitments and
 * the theory in force there, which at a commitments step are that step's and
 * the theory before it, and at a theory step the other way round.
 *
 * `theory` is the theory in force there on its own. It is mostly made of
 * elements already held as commitments, so the held set alone does not show a
 * theory step at all; the graph marks it separately.
 *
 * @param {Array<Array<{id: string, negated?: boolean}>>} evolution
 * @param {number} index
 * @returns {{ held: Set<string>, rejected: Set<string>, theory: Set<string> }}
 */
export function positionAt(evolution, index) {
  const commitments = evolution[index % 2 === 0 ? index : index - 1] ?? [];
  const theoryIndex = index % 2 === 1 ? index : index - 1;
  const theory = theoryIndex >= 1 ? (evolution[theoryIndex] ?? []) : [];
  const held = new Set(
    [...commitments, ...theory].filter((e) => !e.negated).map((e) => e.id),
  );
  const rejected = new Set(
    commitments
      .filter((e) => e.negated && !held.has(e.id))
      .map((e) => e.id),
  );
  return {
    held,
    rejected,
    theory: new Set(theory.filter((e) => !e.negated).map((e) => e.id)),
  };
}

/**
 * What a simulation's result was computed from: the elements' types and
 * statuses, the argument relations, the weights and the depth — everything the
 * request sends that can change the answer. Wording is left out, since rethon
 * never reads it. A result whose key no longer matches the live one describes
 * a position that is not the reader's any more.
 *
 * @param {{ elements: Object[], relations: Object[] }} state
 * @param {Object|null} weights
 * @param {number} depth
 */
export function simulationInputKey(state, weights, depth) {
  return JSON.stringify([
    state.elements.map((e) => [e.id, e.type, e.status]),
    state.relations
      .filter((r) => ARGUMENT_RELATION_TYPES.has(r.type))
      .map((r) => [r.from, r.to, r.type, r.argumentId, r.status, r.supersededBy]),
    weights,
    depth,
  ]);
}

/**
 * What taking up a position would do to the process: the elements it would
 * withdraw, those it would take up again, and those it would reject.
 *
 * Measured against each element's status now, so it answers "what changes if
 * I accept", not "what did the simulation start from". A rejected element the
 * position neither holds nor rejects stays rejected: dropping a negation is
 * not a change the app has a status for.
 *
 * @param {Array<{id: string, status: string}>} elements - The process's elements.
 * @param {{ held: Set<string>, rejected: Set<string> }} position
 */
export function positionChanges(elements, { held, rejected }) {
  const withdraw = [];
  const takeUp = [];
  const reject = [];
  for (const e of elements) {
    const holdsNow = e.status === "active" || e.status === "revised";
    if (rejected.has(e.id)) {
      if (e.status !== "rejected") reject.push(e);
    } else if (held.has(e.id)) {
      if (e.status === "withdrawn" || e.status === "rejected") takeUp.push(e);
    } else if (holdsNow) {
      withdraw.push(e);
    }
  }
  return { withdraw, takeUp, reject };
}

/** Whether a set of changes changes anything. */
export const changesNothing = ({ withdraw, takeUp, reject }) =>
  withdraw.length + takeUp.length + reject.length === 0;

/**
 * The graph's preview of a set of changes: a rejection leaves the position as
 * a withdrawal does, so the canvas draws the two alike.
 *
 * @returns {{ withdrawn: Set<string>, takenUp: Set<string> }}
 */
export function previewOf({ withdraw, takeUp, reject }) {
  return {
    withdrawn: new Set([...withdraw, ...reject].map((e) => e.id)),
    takenUp: new Set(takeUp.map((e) => e.id)),
  };
}

/**
 * Each step of the evolution as what it brought in and dropped, against the
 * last position of the same kind.
 *
 * Step 0 is the commitments the simulation starts from, which are the
 * process's own and so change nothing. Step 1, the first theory, is compared
 * with the theory the user holds: the simulation starts from it (see
 * backend/services/rethon_theory.py), so it too changes nothing unless the
 * held theory was one rethon could not take.
 *
 * @param {Array<Array<Object>>} evolution
 * @param {Array<Object>} heldTheory - The active and revised principles and
 *   background theories.
 * @returns {Array<{ index: number, kind: "commitments"|"theory", joined: Object[], left: Object[] }>}
 */
export function stepChanges(evolution, heldTheory) {
  return evolution.map((position, index) => {
    const kind = stepKind(index);
    const before =
      index === 0 ? position : index === 1 ? heldTheory : evolution[index - 2];
    const beforeKeys = new Set(before.map(entryKey));
    const nowKeys = new Set(position.map(entryKey));
    return {
      index,
      kind,
      joined: position.filter((e) => !beforeKeys.has(entryKey(e))),
      left: before.filter((e) => !nowKeys.has(entryKey(e))),
    };
  });
}

const listed = (els) => els.map((e) => e.id).join(", ");

/**
 * Each step as a sentence, for the log box over the graph — History's
 * `LogOverlay`, which reads `{ round, changes }` and calls `round` a step.
 *
 * A commitments step is read against the commitments before it: an element
 * that joins is taken up, one that leaves is dropped, and a negation joining
 * or leaving is a rejection made or given up. A theory step says what joined
 * and left the theory.
 *
 * @param {ReturnType<typeof stepChanges>} steps
 * @returns {Array<{ round: number, changes: string }>}
 */
export function stepLog(steps) {
  return steps.map(({ index, kind, joined, left }) => {
    const parts = [];
    const plain = (els) => els.filter((e) => !e.negated);
    const negated = (els) => els.filter((e) => e.negated);
    if (index === 0) parts.push("Starts from the elements you accept and reject now.");
    else if (kind === "theory") {
      if (index === 1 && !joined.length && !left.length)
        parts.push("Starts from your active principles and background theories.");
      const verb = (els, one, many) => (els.length > 1 ? many : one);
      if (joined.length)
        parts.push(`${listed(joined)} ${verb(joined, "joins", "join")} the theory.`);
      if (left.length)
        parts.push(`${listed(left)} ${verb(left, "leaves", "leave")} the theory.`);
    } else {
      if (plain(joined).length) parts.push(`Takes up ${listed(plain(joined))}.`);
      if (plain(left).length) parts.push(`Drops ${listed(plain(left))}.`);
      if (negated(joined).length) parts.push(`Rejects ${listed(negated(joined))}.`);
      if (negated(left).length)
        parts.push(`No longer rejects ${listed(negated(left))}.`);
    }
    return {
      round: index,
      changes: parts.length ? parts.join(" ") : "No change.",
    };
  });
}

/** The principles and background theories the user holds: the simulation's first theory. */
export const heldTheoryOf = (elements) =>
  elements.filter(
    (e) =>
      (e.type === "principle" || e.type === "theory") &&
      (e.status === "active" || e.status === "revised"),
  );
