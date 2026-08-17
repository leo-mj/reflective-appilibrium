/**
 * @fileoverview Derived data computations for TextTab.
 * @module hooks/useTextTabData
 */

/** @import { REState, RERelation } from '../types.js' */

import { useMemo } from "react";
import { C, getColors, typeTokens } from "../constants/colors.js";
import { usePalette } from "./useTheme.js";
import { getNeighbours } from "../utils/graphHelpers.js";
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

  // The badge tints its background and border with the fill tone above, but
  // writes the id in this one: the fill tone as 12px bold type measures 3.06:1
  // against its own tinted background.
  const textById = useMemo(
    () =>
      new Map(
        state.elements.map((e) => [
          e.id,
          typeTokens(e.type).text,
        ]),
      ),
    [state.elements],
  );
  const badgeTextColor = (id) => textById.get(id) ?? C.dim;

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

  let highlightedIds = null;
  if (selected) highlightedIds = getNeighbours(selected, visRels);
  else if (selectedArgRels.length > 0)
    highlightedIds = new Set(selectedArgRels.flatMap((r) => [r.from, r.to]));

  const selectedEl = selected
    ? (visibleEls.find((e) => e.id === selected) ?? null)
    : null;
  const neighbourEls = highlightedIds
    ? visibleEls.filter((e) => highlightedIds.has(e.id) && e.id !== selected)
    : [];
  const restEls = highlightedIds
    ? visibleEls.filter((e) => !highlightedIds.has(e.id))
    : visibleEls;

  let hlRels = [];
  if (selected)
    hlRels = visRels.filter((r) => r.from === selected || r.to === selected);
  else if (selectedArgRels.length > 0) hlRels = selectedArgRels;

  let restRels = visRels;
  if (selectedArgRels.length > 0)
    restRels = visRels.filter((r) => !selectedArgRelSet.has(r));
  else if (selected)
    restRels = visRels.filter(
      (r) => r.from !== selected && r.to !== selected,
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
    badgeTextColor,
    displayEls,
    displayRels,
    highlightedIds,
    selectedEl,
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
