/**
 * @fileoverview Derived data computations for TextTab.
 * @module hooks/useTextTabData
 */

/** @import { REState, RERelation } from '../types.js' */

import { useMemo } from "react";
import { C, getColors } from "../constants/colors.js";
import { getNeighbours } from "../utils/graphHelpers.js";
import { findCoherentClusters } from "../utils/clusterUtils.js";
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
 */
export function useTextTabData({
  state,
  hiddenLegendKeys,
  selected,
  selectedRel,
  recentlyAdded,
  recentlyAddedRel,
  search,
}) {
  const isElVisible = (el) => {
    if (el.status === "withdrawn") return !hiddenLegendKeys?.has("withdrawn");
    if (el.status === "rejected") return !hiddenLegendKeys?.has("rejected");
    if (el.type === "judgment") return !hiddenLegendKeys?.has(`J-${el.confidence}`);
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
  const colorById = useMemo(
    () =>
      new Map(
        state.elements.map((e) => [
          e.id,
          getColors({ ...e, status: "active" }).stroke,
        ]),
      ),
    [state.elements],
  );
  const badgeColor = (id) => colorById.get(id) ?? C.dim;

  const displayEls = search
    ? visibleEls.filter((e) => matchesSearch(e, search))
    : visibleEls;
  const displayRels = search
    ? visRels.filter((r) => matchesSearchRel(r, search))
    : visRels;

  let highlightedIds = null;
  if (selected) highlightedIds = getNeighbours(selected, visRels);
  else if (selectedRel)
    highlightedIds = new Set([selectedRel.from, selectedRel.to]);

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
  else if (selectedRel) hlRels = [selectedRel];

  let restRels = visRels;
  if (selectedRel) restRels = visRels.filter((r) => r !== selectedRel);
  else if (selected)
    restRels = visRels.filter(
      (r) => r.from !== selected && r.to !== selected,
    );

  const hasCoherence =
    state.coherence.tensions.length > 0 ||
    state.coherence.orphans.length > 0 ||
    state.coherence.clusters.length > 0;
  const clusters = useMemo(() => findCoherentClusters(state), [state]);
  const clusterCount = clusters.length;

  const pinnedEl = recentlyAdded
    ? (visibleEls.find((e) => e.id === recentlyAdded) ?? null)
    : null;
  const pinnedRel = recentlyAddedRel && visRels.includes(recentlyAddedRel)
    ? recentlyAddedRel
    : null;

  return {
    visibleEls,
    visRels,
    pCovers,
    badgeColor,
    displayEls,
    displayRels,
    highlightedIds,
    selectedEl,
    neighbourEls,
    restEls,
    hlRels,
    restRels,
    hasCoherence,
    clusters,
    clusterCount,
    pinnedEl,
    pinnedRel,
  };
}
