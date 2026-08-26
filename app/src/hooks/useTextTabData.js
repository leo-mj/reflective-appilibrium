/**
 * @fileoverview Derived data computations for TextTab.
 * @module hooks/useTextTabData
 */

/** @import { REState, RERelation } from '../types.js' */

import { useMemo } from "react";
import { C, getColors, inkOn, typeTokens } from "../constants/colors.js";
import { usePalette } from "./useTheme.js";
import { getNeighbours } from "../utils/graphHelpers.js";
import { groupsOf, selectionIds } from "../utils/groupUtils.js";
import { findCoherentClusters } from "../utils/clusterUtils.js";
import { computeCoherence } from "../utils/coherence.js";
import {
  buildPrincipleCovers,
  matchesSearch,
  matchesSearchRel,
} from "../utils/textTabHelpers.js";

/**
 * Computes all derived display data for the TextTab from raw state + filter flags.
 *
 * @param {Object}          opts
 * @param {REState}         opts.state
 * @param {Set<string>}     opts.hiddenLegendKeys
 * @param {string|null}     opts.selected
 * @param {RERelation|null} opts.selectedRel
 * @param {string}          opts.search
 * @param {boolean}         [opts.hideNonEntailsRels] - The graph is showing
 *   arguments only; coherence follows the same visibility.
 */
export function useTextTabData({
  state,
  hiddenLegendKeys,
  selected,
  selectedRel,
  recentlyAdded,
  recentlyAddedRel,
  search,
  hideNonEntailsRels,
}) {
  const isElVisible = (el) => {
    if (el.status === "possible") return false;
    if (el.status === "withdrawn") return !hiddenLegendKeys?.has("withdrawn");
    if (el.status === "rejected") return !hiddenLegendKeys?.has("rejected");
    if (el.type === "judgment") return !hiddenLegendKeys?.has("J");
    if (el.type === "principle") return !hiddenLegendKeys?.has("P");
    if (el.type === "theory") return !hiddenLegendKeys?.has("T");
    return true;
  };
  const visibleEls = state.elements.filter(isElVisible);
  const visIds = new Set(visibleEls.map((e) => e.id));
  const visRels = state.relations.filter(
    (r) =>
      visIds.has(r.from) &&
      visIds.has(r.to) &&
      !hiddenLegendKeys?.has(r.type) &&
      !(hiddenLegendKeys?.has("withdrawn") && r.status === "withdrawn") &&
      !(hiddenLegendKeys?.has("rejected") && r.status === "rejected"),
  );
  const pCovers = buildPrincipleCovers(
    visibleEls.filter((e) => e.type === "principle"),
    state.relations,
    visIds,
    state.elements,
  );
  const palette = usePalette();
  const colorById = useMemo(
    () =>
      new Map(
        state.elements.map((e) => [
          e.id,
          getColors({ ...e, status: "active" }, palette).stroke,
        ]),
      ),
    [state.elements, palette],
  );
  const badgeColor = (id) => colorById.get(id) ?? C.dim;

  // The badge is drawn the way the graph's own +J/+P/+T buttons are drawn — the
  // type's `high` fill with the ink that fill takes (Graph.jsx:97). Both come
  // from the palette in force, so the badge carries the node's colour in every
  // mode rather than only in the one its tones were picked for.
  //
  // It used to write the id in `typeTokens(type).text`, a CSS variable that
  // varies by theme but *not* by contrast mode: in high-contrast the tint and
  // border moved to the accessible ramp while the ink stayed on the default
  // one, so a magenta principle node had a violet principle badge. Two of those
  // six variables were not ramp values at all.
  //
  // `inkOn` rather than `palette.ink` because a badge is an HTML button, and
  // app/CLAUDE.md draws that line: the nodes are the exception to AA, a button
  // is not. `palette.ink` is white in the default mode, which the theory amber
  // carries at only 3.19:1.
  const badgeById = useMemo(
    () =>
      new Map(
        state.elements.map((e) => {
          const fill = typeTokens(e.type, palette).high;
          return [e.id, { fill, ink: inkOn(fill) }];
        }),
      ),
    [state.elements, palette],
  );
  const badgeFill = (id) => badgeById.get(id)?.fill ?? C.border;
  const badgeTextColor = (id) => badgeById.get(id)?.ink ?? C.text;

  const displayEls = search
    ? visibleEls.filter((e) => matchesSearch(e, search))
    : visibleEls;
  const displayRels = search
    ? visRels.filter((r) => matchesSearchRel(r, search))
    : visRels;

  // All relations belonging to the same argument as selectedRel (or just [selectedRel]).
  const selectedArgRels = selectedRel?.argumentId
    ? visRels.filter((r) => r.argumentId === selectedRel.argumentId)
    : selectedRel
      ? [selectedRel]
      : [];
  const selectedArgRelSet = new Set(selectedArgRels);

  // A selection is one id, but a group's is the group *and* its members: this
  // panel holds no node called "G1", so reading the selection literally left a
  // selected group showing its own name over an empty card.
  const groups = groupsOf(state);
  const selectedGroup = selected
    ? (groups.find((g) => g.id === selected) ?? null)
    : null;
  const focusIds = selectionIds(groups, selected).filter((id) => visIds.has(id));
  const focusSet = new Set(focusIds);

  let highlightedIds = null;
  if (focusIds.length > 0)
    highlightedIds = new Set(
      focusIds.flatMap((id) => [...getNeighbours(id, visRels)]),
    );
  else if (selectedArgRels.length > 0)
    highlightedIds = new Set(selectedArgRels.flatMap((r) => [r.from, r.to]));

  const selectedEl = selected
    ? (visibleEls.find((e) => e.id === selected) ?? null)
    : null;
  // What the selection *is*, as cards: the element itself, or a group's members.
  const selectedEls = selectedGroup
    ? visibleEls.filter((e) => focusSet.has(e.id))
    : selectedEl
      ? [selectedEl]
      : [];
  const selectedIdSet = new Set(selectedEls.map((e) => e.id));
  const neighbourEls = highlightedIds
    ? visibleEls.filter(
        (e) => highlightedIds.has(e.id) && !selectedIdSet.has(e.id),
      )
    : [];
  const restEls = highlightedIds
    ? visibleEls.filter((e) => !highlightedIds.has(e.id))
    : visibleEls;

  let hlRels = [];
  if (focusIds.length > 0)
    hlRels = visRels.filter((r) => focusSet.has(r.from) || focusSet.has(r.to));
  else if (selectedArgRels.length > 0) hlRels = selectedArgRels;

  let restRels = visRels;
  if (selectedArgRels.length > 0)
    restRels = visRels.filter((r) => !selectedArgRelSet.has(r));
  else if (focusIds.length > 0)
    restRels = visRels.filter(
      (r) => !focusSet.has(r.from) && !focusSet.has(r.to),
    );

  // Read off the graph rather than taken from `state.coherence`, which nothing
  // in Phase 2 ever writes — see utils/coherence.js. Given the same relation
  // visibility the graph uses, so the two cannot disagree.
  const coherence = useMemo(
    () =>
      computeCoherence(state.elements, state.relations, {
        showRelations: !hideNonEntailsRels,
      }),
    [state.elements, state.relations, hideNonEntailsRels],
  );
  const hasCoherence =
    coherence.tensions.length > 0 ||
    coherence.orphans.length > 0 ||
    coherence.possibleSupport.length > 0;
  const clusters = useMemo(() => findCoherentClusters(state), [state]);
  const clusterCount = clusters.length;

  const pinnedEl = recentlyAdded
    ? (visibleEls.find((e) => e.id === recentlyAdded) ?? null)
    : null;
  const pinnedRel = recentlyAddedRel && visRels.includes(recentlyAddedRel)
    ? recentlyAddedRel
    : null;
  const pinnedArgRels = pinnedRel?.argumentId
    ? visRels.filter((r) => r.argumentId === pinnedRel.argumentId)
    : null;

  return {
    visibleEls,
    visRels,
    pCovers,
    badgeColor,
    badgeFill,
    badgeTextColor,
    displayEls,
    displayRels,
    highlightedIds,
    selectedEl,
    selectedEls,
    selectedGroup,
    neighbourEls,
    restEls,
    hlRels,
    restRels,
    coherence,
    hasCoherence,
    clusters,
    clusterCount,
    pinnedEl,
    pinnedRel,
    pinnedArgRels,
  };
}
