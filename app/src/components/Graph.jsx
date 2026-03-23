/**
 * @fileoverview Interactive force-directed graph for the main Graph tab.
 * @module components/Graph
 */

/** @import { REState, PositionMap } from '../types.js' */

import { useState, useRef } from "react";

import { useContainerDims } from "../hooks/useContainerDims.js";
import { usePan } from "../hooks/usePan.js";
import { hitRadius, getNeighbours, distToSegment } from "../utils/graphHelpers.js";
import { elementsAtRound } from "../utils/stateUtils.js";
import { GraphCanvas, renderEdge, renderNode, graphEdgeVisuals, graphNodeVisuals } from "./GraphElements.jsx";

/**
 * Renders the main force-directed graph for the Graph tab.
 *
 * ### Layout
 * Node positions come from the shared `positions` prop produced by
 * {@link module:hooks/useStablePositions} in the parent `REState` component.
 * The graph itself does not run any simulation.
 *
 * ### Interaction
 * - **Pan** — drag anywhere on the SVG via {@link module:hooks/usePan}.
 * - **Click to highlight** — click a node to highlight it and its immediate
 *   neighbours; all other nodes and edges dim to low opacity.  Click the same
 *   node again, or click the background, to deselect.
 * - **Click an edge** — selects the relation; its two endpoint nodes highlight.
 * - **Hover tooltip** — hovering over a node shows a {@link module:components/NodeTooltip}.
 *
 * A click is distinguished from a drag by comparing pointer-up to pointer-down
 * positions (threshold: 4 px).
 *
 * @param {Object}      props
 * @param {REState}     props.state
 * @param {boolean}     props.showWithdrawn
 * @param {PositionMap} props.positions
 * @param {string|null} props.selected
 * @param {function(function): void} props.onSelect
 * @param {import('../types.js').RERelation|null} props.selectedRel
 * @param {function(function): void} props.onSelectRel
 * @returns {React.ReactElement}
 */
export function Graph({ state, showWithdrawn, positions, selected, onSelect, selectedRel, onSelectRel }) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  const [tooltip, setTooltip] = useState(null);

  // ── Pan + click detection ─────────────────────────────────────────────────

  const { pan, isDragging, onPointerDown: panDown, onPointerMove, onPointerUp: panUp } = usePan();
  const clickOrigin = useRef(null);

  /** @param {React.PointerEvent} e */
  const onPointerDown = (e) => {
    panDown(e);
    clickOrigin.current = { x: e.clientX, y: e.clientY };
    setTooltip(null);
  };

  /** @param {React.PointerEvent} e */
  const onPointerUp = (e) => {
    panUp(e);
    if (!clickOrigin.current) return;
    const { x: ox, y: oy } = clickOrigin.current;
    clickOrigin.current = null;
    if (Math.abs(e.clientX - ox) > 4 || Math.abs(e.clientY - oy) > 4) return; // drag

    // Convert screen → simulation coordinates.
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left - pan.x;
    const sy = e.clientY - rect.top  - pan.y;

    // Node hit-test first.
    for (const el of visibleEls) {
      const pos = positions[el.id];
      if (!pos) continue;
      if ((pos.x - sx) ** 2 + (pos.y - sy) ** 2 < hitRadius(el.type) ** 2) {
        onSelectRel(() => null);
        onSelect(prev => prev === el.id ? null : el.id);
        return;
      }
    }

    // Edge hit-test (threshold 8 px).
    for (const r of visRels) {
      const sp = positions[r.from], tp = positions[r.to];
      if (!sp || !tp) continue;
      if (distToSegment(sx, sy, sp.x, sp.y, tp.x, tp.y) < 8) {
        onSelect(() => null);
        onSelectRel(prev => prev === r ? null : r);
        return;
      }
    }

    // Clicked background — clear selection.
    onSelect(() => null);
    onSelectRel(() => null);
  };

  // ── Derived visibility and highlight sets ─────────────────────────────────

  const { active, withdrawn } = elementsAtRound(state.elements, state.round);
  const wIds = new Set(withdrawn.map(e => e.id));
  const visibleEls = showWithdrawn ? [...active, ...withdrawn] : active;
  const visIds = new Set(visibleEls.map(e => e.id));
  const visRels = state.relations.filter(r => visIds.has(r.from) && visIds.has(r.to));

  const highlightedIds = selected
    ? getNeighbours(selected, visRels)
    : selectedRel
      ? new Set([selectedRel.from, selectedRel.to])
      : null;

  const dimNode = (id) => highlightedIds && !highlightedIds.has(id);
  const dimEdge = (r) => {
    if (selectedRel)    return r !== selectedRel;
    if (highlightedIds) return r.from !== selected && r.to !== selected;
    return false;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <GraphCanvas
      containerRef={containerRef} dims={dims} pan={pan} isDragging={isDragging}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      tooltip={tooltip} containerStyle={{ width: "100%", height: "100%" }}>

      {/* ── Edges ── */}
      {visRels.map((r, i) => renderEdge(r, i, positions, state.elements, graphEdgeVisuals(r, wIds, dimEdge, selectedRel)))}

      {/* ── Nodes ── */}
      {visibleEls.map(el => renderNode(el, positions, graphNodeVisuals(el, wIds, dimNode, selected), isDragging, setTooltip))}

    </GraphCanvas>
  );
}
