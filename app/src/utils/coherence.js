/**
 * @fileoverview Coherence observations read off the relation graph.
 *
 * Three things about a set of commitments can be seen without asking anyone:
 * which pairs pull against each other, which elements are attached to nothing,
 * and which set-aside elements still stand in a supporting relation to what is
 * currently held. All fall straight out of the relations the user has already
 * drawn, so they are computed here rather than requested from a model — which
 * means they are exact, current as of the last edit, and available in the demo
 * build where there is no backend at all.
 *
 * Clusters are deliberately not computed here: the Clusters tab already derives
 * them properly, from `utils/clusterUtils.js`.
 *
 * @module utils/coherence
 */

/** @import { REElement, RERelation } from '../types.js' */

import {
  ARGUMENT_RELATION_TYPES,
  isWithdrawnNow,
  relationTypeLabel,
} from "./stateUtils.js";

/**
 * Relations that describe two commitments pulling against each other.
 *
 * `precludes` and `jointly_precludes` belong here as much as `conflicts` does:
 * they say the premises entail the *negation* of the conclusion, which is the
 * sharpest form of incompatibility the model has. They are also the only
 * tensions visible at all when the graph is showing arguments only.
 */
const TENSION_TYPES = new Set([
  "conflicts",
  "undermines",
  "precludes",
  "jointly_precludes",
]);

/**
 * Relations in which one side speaks for the other.
 *
 * `depends` is not here: presupposing something is not the same as supporting
 * it, and reinstating on that basis would be a different move.
 */
const SUPPORT_TYPES = new Set(["supports", "entails", "jointly_entails"]);

/** "jointly_precludes" → "jointly precludes". */
const label = (type) => relationTypeLabel(type).replace(/_/g, " ");

/** Statuses that mean an element is not currently held. */
const NOT_HELD = new Set(["withdrawn", "rejected", "possible"]);

/**
 * Statuses meaning the user put this aside deliberately.
 *
 * `possible` is excluded: those are questionnaire options nobody has ruled on,
 * so there is nothing to reconsider.
 */
const SET_ASIDE = new Set(["withdrawn", "rejected"]);

/**
 * True when the user currently holds this element or relation.
 *
 * Both `status` and the history are consulted. `isWithdrawnNow` reads the
 * history, which is the authority once an item has one, but a relation may
 * carry a bare `status: "withdrawn"` with no event behind it — older states do,
 * and so does anything hand-written. Either one is enough to take it out.
 */
const isHeld = (item) => !NOT_HELD.has(item.status) && !isWithdrawnNow(item);

/**
 * Tensions, orphans, and possible support among the current commitments.
 *
 * Tensions and orphans look only at what is held: a conflict with a commitment
 * you have already given up is not a tension you still have, and an element
 * whose only relations point at withdrawn ones is an orphan in fact.
 *
 * Possible support looks across that line on purpose. It is the one place a
 * withdrawn or rejected element is worth naming: something you set aside may
 * still support — or be supported by — what you now hold, and that is a reason
 * to look at it again rather than a defect to fix.
 *
 * `showRelations` must match what the graph is drawing. With arguments-only
 * mode on — the default — plain relations are not on screen, and counting them
 * here produced a section describing a graph the reader could not see: tensions
 * with no edge behind them, and elements that looked stranded going unlisted
 * because of a relation that was being hidden. Same rule as ClusterTab.
 *
 * @param {REElement[]}  elements
 * @param {RERelation[]} relations
 * @param {Object}  [opts]
 * @param {boolean} [opts.showRelations=true] - False when the graph is showing
 *   arguments only, i.e. `hideNonEntailsRels`.
 * @returns {{tensions: string[], orphans: string[], possibleSupport: string[]}}
 */
export function computeCoherence(elements, relations, { showRelations = true } = {}) {
  const held = elements.filter(isHeld);
  const heldIds = new Set(held.map((e) => e.id));
  const statusById = new Map(elements.map((e) => [e.id, e.status]));
  const isSetAside = (id) => SET_ASIDE.has(statusById.get(id));

  // Whether the graph is currently drawing this kind of edge at all.
  const isVisibleType = (r) =>
    showRelations || ARGUMENT_RELATION_TYPES.has(r.type);

  const liveRelations = relations.filter(
    (r) =>
      isHeld(r) && heldIds.has(r.from) && heldIds.has(r.to) && isVisibleType(r),
  );

  const tensions = [];
  const seen = new Set();
  for (const r of liveRelations) {
    if (!TENSION_TYPES.has(r.type)) continue;
    // One line per directed pair and type: the same pair may genuinely hold
    // both a conflict and an undermining, and those are different observations.
    const key = `${r.from}|${r.to}|${r.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tensions.push(`${r.from} ${label(r.type)} ${r.to}`);
  }

  const connected = new Set();
  for (const r of liveRelations) {
    connected.add(r.from);
    connected.add(r.to);
  }
  const orphans = held
    .filter((e) => !connected.has(e.id))
    .map((e) => `${e.id} — not related to anything else`);

  // Supporting relations that straddle the line between what is held and what
  // has been set aside. The relation itself must still stand: withdrawing the
  // relation is retracting the claim, which is not a reason to reconsider
  // anything.
  const possibleSupport = [];
  const seenSupport = new Set();
  for (const r of relations) {
    if (!isHeld(r) || !SUPPORT_TYPES.has(r.type) || !isVisibleType(r)) continue;
    const fromHeld = heldIds.has(r.from);
    const toHeld = heldIds.has(r.to);
    const straddles =
      (fromHeld && isSetAside(r.to)) || (isSetAside(r.from) && toHeld);
    if (!straddles) continue;

    const key = `${r.from}|${r.to}|${r.type}`;
    if (seenSupport.has(key)) continue;
    seenSupport.add(key);

    // The set-aside side is marked, so the line says which end is the one to
    // reconsider without the reader having to look it up.
    const name = (id) =>
      isSetAside(id) ? `${id} (${statusById.get(id)})` : id;
    possibleSupport.push(`${name(r.from)} ${label(r.type)} ${name(r.to)}`);
  }

  return { tensions, orphans, possibleSupport };
}
