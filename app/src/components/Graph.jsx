/**
 * @fileoverview Interactive force-directed graph for the main Graph tab.
 * @module components/Graph
 */

/** @import { REState, PositionMap } from '../types.js' */

import { useState, useRef } from "react";
import { C, confOp, TRANSITION, getColors } from "../constants/colors.js";
import { useContainerDims } from "../hooks/useContainerDims.js";
import { usePan } from "../hooks/usePan.js";
import { nodeRadius, hitRadius, edgeDashArray, arrowGeometry, getNeighbours, distToSegment } from "../utils/graphHelpers.js";
import { NodeShape } from "./NodeShape.jsx";
import { NodeTooltip } from "./NodeTooltip.jsx";

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

  const visibleEls = showWithdrawn
    ? state.elements
    : state.elements.filter(e => e.status !== "withdrawn");
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
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {dims.w > 0 && (
        <svg width={dims.w} height={dims.h}
          style={{ background: C.bg, borderRadius: 8, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          <g transform={`translate(${pan.x},${pan.y})`}>

            {/* ── Edges ── */}
            {visRels.map((r, i) => {
              const sp = positions[r.from], tp = positions[r.to];
              if (!sp || !tp) return null;
              const sEl = state.elements.find(e => e.id === r.from);
              const tEl = state.elements.find(e => e.id === r.to);
              const isW  = sEl?.status === "withdrawn" || tEl?.status === "withdrawn";
              const isSel = r === selectedRel;
              const color  = isW ? C.withdrawn : C[r.type];
              const baseOp = isW ? 0.25 : 0.7;
              const opacity   = dimEdge(r) ? baseOp * 0.12 : baseOp;
              const strokeW   = isSel ? 3.5 : dimEdge(r) ? 1.5 : 2;
              const { x1, y1, x2, y2, tipX, tipY, perpX, perpY } = arrowGeometry(
                sp, tp, nodeRadius(sEl?.type), nodeRadius(tEl?.type)
              );
              return (
                <g key={i} opacity={opacity} style={{ transition: TRANSITION }}>
                  {/* Wide transparent stroke for easier hit-testing */}
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={16} />
                  <line x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={color} strokeWidth={strokeW}
                    strokeDasharray={edgeDashArray(r.type)} />
                  <polygon
                    points={`${tipX},${tipY} ${x2 + perpX * 5},${y2 + perpY * 5} ${x2 - perpX * 5},${y2 - perpY * 5}`}
                    fill={color} />
                </g>
              );
            })}

            {/* ── Nodes ── */}
            {visibleEls.map(e => {
              const pos = positions[e.id];
              if (!pos) return null;
              const isW  = e.status === "withdrawn";
              const isSel = e.id === selected;
              const { fill, stroke } = getColors(e);
              const op     = isW ? 0.25 : confOp[e.confidence];
              const nodeOp = dimNode(e.id) ? 0.12 : op;
              const r = nodeRadius(e.type);
              return (
                <g key={e.id} transform={`translate(${pos.x},${pos.y})`}
                  style={{ cursor: isDragging ? "grabbing" : "pointer", transition: TRANSITION, opacity: nodeOp }}
                  onMouseEnter={(ev) => {
                    if (isDragging) return;
                    const rect = ev.currentTarget.closest("svg").getBoundingClientRect();
                    setTooltip({ x: ev.clientX - rect.left, y: ev.clientY - rect.top - 10, el: e });
                  }}
                  onMouseLeave={() => setTooltip(null)}>
                  {isSel && <circle r={r + 8} fill="none" stroke="#fff" strokeWidth={2} opacity={0.45} />}
                  <NodeShape e={e} r={r} fill={fill} stroke={stroke} op={1} />
                  <text textAnchor="middle" dy="0.35em" fill={isW ? "#666" : "#fff"}
                    fontSize={e.type === "principle" ? 13 : 11} fontWeight="bold"
                    style={{ textDecoration: isW ? "line-through" : "none", pointerEvents: "none" }}>
                    {e.id}
                  </text>
                </g>
              );
            })}

          </g>
        </svg>
      )}
      <NodeTooltip tooltip={tooltip} />
    </div>
  );
}
