/**
 * @fileoverview What the Graph tab draws, and how it fades — the calculations
 * `components/Graph.jsx` makes before drawing anything, kept here as plain
 * functions so they are tested as such rather than only through the canvas.
 *
 * @module utils/graphView
 */

/** @import { REState, REElement, RERelation, REGroup } from '../types.js' */

import { getNeighbours } from "./graphHelpers.js";
import { selectionIds } from "./groupUtils.js";
import { elementsAtRound } from "./stateUtils.js";
import { matchesSearchRel, searchFinds } from "./textTabHelpers.js";

/**
 * The elements and relations the canvas draws, before groups are projected.
 *
 * Projecting groups after this filter rather than before is what keeps the two
 * consistent: a group whose members the legend has hidden has nothing left to
 * stand for.
 *
 * @param {REState} state
 * @param {Set<string>|null|undefined} hiddenLegendKeys - What the legend hides:
 *   `J`, `P`, `T`, `withdrawn`, `rejected`, and relation types.
 * @param {Set<string>|null|undefined} previewWithdrawnIds - The equilibrium
 *   preview's withdrawals, whose edges are left out.
 * @returns {{ visibleEls: REElement[], visRels: RERelation[], wIds: Set<string> }}
 *   `wIds` holds every element withdrawn at the state's round, drawn or not.
 */
export function drawnOnGraph(state, hiddenLegendKeys, previewWithdrawnIds) {
  const hidden = (key) => hiddenLegendKeys?.has(key) ?? false;
  const { active, withdrawn } = elementsAtRound(state.elements, state.round);
  const rejected = state.elements.filter((e) => e.status === "rejected");
  const isVisible = (el) => {
    if (el.status === "possible") return false;
    if (el.status === "withdrawn") return !hidden("withdrawn");
    if (el.status === "rejected") return !hidden("rejected");
    if (el.type === "judgment") return !hidden("J");
    if (el.type === "principle") return !hidden("P");
    if (el.type === "theory") return !hidden("T");
    return true;
  };
  const visibleEls = [
    // `elementsAtRound` splits purely on round and withdrawal, so a rejected
    // element comes back in `active` too; dropping it here stops it from being
    // drawn twice.
    ...active.filter((e) => e.status !== "rejected"),
    ...withdrawn,
    ...rejected,
  ].filter(isVisible);
  const visIds = new Set(visibleEls.map((e) => e.id));
  const visRels = state.relations.filter(
    (r) =>
      visIds.has(r.from) &&
      visIds.has(r.to) &&
      !hidden(r.type) &&
      !(hidden("withdrawn") && r.status === "withdrawn") &&
      !(hidden("rejected") && r.status === "rejected") &&
      !(previewWithdrawnIds?.has(r.from) || previewWithdrawnIds?.has(r.to)),
  );
  return {
    visibleEls,
    visRels,
    wIds: new Set(withdrawn.map((e) => e.id)),
  };
}

/**
 * What the canvas lights up and what it fades, for a selection, a ctrl+click
 * chain or a search.
 *
 * @param {Object} args
 * @param {REGroup[]} args.groups
 * @param {string|null} args.selected - An element's id, or a group's.
 * @param {RERelation|null} args.selectedRel - As held in state.
 * @param {string[]} args.ctrlArgNodes - Ctrl-clicked since `selected`.
 * @param {Array<{ id: string }>} args.displayEls - What is drawn, groups projected.
 * @param {RERelation[]} args.displayRels - Likewise; some re-pointed copies.
 * @param {function(RERelation): RERelation} args.toSourceRel - A drawn edge's
 *   relation as held in state.
 * @param {string} args.query - The text panel's search, trimmed.
 * @param {Map<string, REElement>} args.elementById - As held in state, for a
 *   collapsed group's members.
 * @returns {{ highlightedIds: Set<string>|null, selectedArgRelSet: Set<RERelation>,
 *   dimNode: function(string): boolean, dimEdge: function(RERelation): boolean }}
 */
export function graphHighlights({
  groups,
  selected,
  selectedRel,
  ctrlArgNodes,
  displayEls,
  displayRels,
  toSourceRel,
  query,
  elementById,
}) {
  // What the selection covers, narrowed to what is actually on the canvas: a
  // selected group is its own node while collapsed and its members once
  // expanded, and it can be selected in either state.
  const displayIds = new Set(displayEls.map((e) => e.id));
  const focusIds = selectionIds(groups, selected).filter((id) =>
    displayIds.has(id),
  );
  const focusSet = new Set(focusIds);

  // All relations belonging to the same argument as selectedRel (or just the
  // edges standing for it, of which a re-pointed one is not the same object).
  const selectedArgRels = selectedRel?.argumentId
    ? displayRels.filter((r) => r.argumentId === selectedRel.argumentId)
    : selectedRel
      ? displayRels.filter((r) => toSourceRel(r) === selectedRel)
      : [];
  const selectedArgRelSet = new Set(selectedArgRels);

  const highlightedIds =
    ctrlArgNodes.length > 0 && selected
      ? new Set([selected, ...ctrlArgNodes])
      : focusIds.length > 0
        ? new Set(focusIds.flatMap((id) => [...getNeighbours(id, displayRels)]))
        : selectedArgRels.length > 0
          ? new Set(selectedArgRels.flatMap((r) => [r.from, r.to]))
          : null;

  // What the text panel's search finds, by the panel's own test, so the two
  // agree on what matches. A collapsed group stands for its members.
  const found = searchFinds(displayEls, query, elementById);

  // Faded by a selection elsewhere, and by a search that did not find it —
  // the same fade, so a search reads as a selection made by typing.
  const dimNode = (id) =>
    (highlightedIds && !highlightedIds.has(id)) || (found && !found.has(id));
  const dimEdge = (r) => {
    if (selectedRel) return !selectedArgRelSet.has(r);
    if (highlightedIds) return !focusSet.has(r.from) && !focusSet.has(r.to);
    // Lit exactly when the panel lists it: by the panel's own test for a
    // relation, and not merely for having a found element at one end — the
    // graph and the panel show the same relations. Asked of the relation held
    // in state, which is what the panel lists: an edge into a collapsed group
    // is drawn from a copy pointed at the group instead.
    if (found) return !matchesSearchRel(toSourceRel(r), query);
    return false;
  };

  return { highlightedIds, selectedArgRelSet, dimNode, dimEdge };
}
