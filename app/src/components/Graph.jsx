/**
 * @fileoverview Interactive force-directed graph for the main Graph tab.
 * @module components/Graph
 */

/** @import { REState, PositionMap } from '../types.js' */

import { useState, useRef } from "react";
import { C, confOp, TRANSITION, getColors } from "../constants/colors.js";
import { useContainerDims } from "../hooks/useContainerDims.js";
import { NodeShape } from "./NodeShape.jsx";

/**
 * Returns the set of element IDs that should remain highlighted when `selectedId`
 * is selected: the selected node itself plus every node directly connected to it
 * by any visible relation (in either direction).
 *
 * @param {string}       selectedId - ID of the selected element.
 * @param {import('../types.js').RERelation[]} visRels - Currently visible relations.
 * @returns {Set<string>} IDs of the selected node and its immediate neighbours.
 */
function getNeighbours(selectedId, visRels) {
  const ids = new Set([selectedId]);
  visRels.forEach(r => {
    if (r.from === selectedId) ids.add(r.to);
    if (r.to === selectedId) ids.add(r.from);
  });
  return ids;
}

/**
 * Renders the main force-directed graph for the Graph tab.
 *
 * ### Layout
 * Node positions come from the shared `positions` prop produced by
 * {@link module:hooks/useStablePositions} in the parent `REState` component.
 * The graph itself does not run any simulation.
 *
 * ### Interaction
 * - **Pan** — drag anywhere on the SVG to pan, using the Pointer Events API
 *   (`setPointerCapture` ensures smooth dragging even if the pointer leaves the SVG).
 * - **Click to highlight** — click a node to highlight it and its immediate neighbours;
 *   all other nodes and edges dim to low opacity.  Click the same node again, or click
 *   the background, to deselect.  A click is distinguished from a drag by comparing the
 *   pointer-up position to the pointer-down position (threshold: 4 px).
 * - **Hover tooltip** — hovering over a node shows a detail card above it.
 *
 * ### Withdrawn elements
 * When `showWithdrawn` is `false`, withdrawn elements and any edges touching them
 * are excluded from both rendering and hit-testing.  When `true` they appear at
 * 25 % opacity with grey styling.
 *
 * @param {Object}      props
 * @param {REState}     props.state          - Full RE state.
 * @param {boolean}     props.showWithdrawn  - Whether to render withdrawn elements.
 * @param {PositionMap} props.positions      - Force-simulation positions keyed by element ID.
 * @param {string|null} props.selected       - ID of the currently selected element, or `null`.
 * @param {function(function(string|null): string|null): void} props.onSelect
 *   Updater function called when the user clicks a node or the background.
 *   Receives a functional update `prev => next` so it can toggle.
 * @returns {React.ReactElement}
 */
/**
 * Returns the shortest distance from point (px, py) to the line segment (ax,ay)→(bx,by).
 * Used for edge hit-testing.
 * @param {number} px @param {number} py
 * @param {number} ax @param {number} ay
 * @param {number} bx @param {number} by
 * @returns {number}
 */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function Graph({ state, showWithdrawn, positions, selected, onSelect, selectedRel, onSelectRel }) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  const [tooltip, setTooltip] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  /** Pointer-down screen position; compared to pointer-up to detect drag vs click. */
  const clickOrigin = useRef(null);

  /** @param {React.PointerEvent<SVGSVGElement>} e */
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX - pan.x, py: e.clientY - pan.y };
    clickOrigin.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    setTooltip(null);
  };

  /** @param {React.PointerEvent<SVGSVGElement>} e */
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setPan({ x: e.clientX - dragRef.current.px, y: e.clientY - dragRef.current.py });
  };

  /**
   * On pointer-up, determine whether the gesture was a drag or a click.
   * If it was a click, hit-test all visible nodes in simulation space and
   * toggle selection on the one that was clicked, or deselect if background.
   *
   * Node positions from the simulation are in an unscaled coordinate system.
   * The pan offset is subtracted from the cursor position so the hit-test
   * is in the same space as the node coordinates.
   *
   * @param {React.PointerEvent<SVGSVGElement>} e
   */
  const onPointerUp = (e) => {
    dragRef.current = null;
    setIsDragging(false);
    if (!clickOrigin.current) return;
    const dx = e.clientX - clickOrigin.current.x;
    const dy = e.clientY - clickOrigin.current.y;
    clickOrigin.current = null;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) return; // was a drag, not a click

    // Convert screen coords to simulation coords (accounting for pan offset).
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left - pan.x;
    const sy = e.clientY - rect.top - pan.y;

    // Node hit-test first.
    let hitNode = null;
    for (const el of visibleEls) {
      const pos = positions[el.id];
      if (!pos) continue;
      const hitR = el.type === "principle" ? 36 : el.type === "theory" ? 30 : 24;
      if ((pos.x - sx) ** 2 + (pos.y - sy) ** 2 < hitR ** 2) { hitNode = el.id; break; }
    }
    if (hitNode !== null) {
      onSelectRel(() => null);
      onSelect(prev => prev === hitNode ? null : hitNode);
      return;
    }

    // Edge hit-test (threshold 8px).
    let hitRel = null;
    for (const r of visRels) {
      const sp = positions[r.from], tp = positions[r.to];
      if (!sp || !tp) continue;
      if (distToSegment(sx, sy, sp.x, sp.y, tp.x, tp.y) < 8) { hitRel = r; break; }
    }
    onSelect(() => null);
    onSelectRel(prev => prev === hitRel ? null : hitRel);
  };

  const visibleEls = showWithdrawn ? state.elements : state.elements.filter(e => e.status !== "withdrawn");
  const visIds = new Set(visibleEls.map(e => e.id));
  const visRels = state.relations.filter(r => visIds.has(r.from) && visIds.has(r.to));

  // When a node is selected, everything outside its neighbourhood dims out.
  // When a relation is selected, only that relation and its two endpoints are highlighted.
  const highlightedIds = selected
    ? getNeighbours(selected, visRels)
    : selectedRel
      ? new Set([selectedRel.from, selectedRel.to])
      : null;
  const dimNode = (id) => highlightedIds && !highlightedIds.has(id);
  const dimEdge = (r) => {
    if (selectedRel) return r !== selectedRel;
    if (highlightedIds) return r.from !== selected && r.to !== selected;
    return false;
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {dims.w > 0 && (
        <svg width={dims.w} height={dims.h}
          style={{ background: C.bg, borderRadius: 8, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          {/* All graph content is inside this <g> so that panning only requires a single transform. */}
          <g transform={`translate(${pan.x},${pan.y})`}>
            {visRels.map((r, i) => {
              const sp = positions[r.from], tp = positions[r.to];
              if (!sp || !tp) return null;
              const sEl = state.elements.find(e => e.id === r.from);
              const tEl = state.elements.find(e => e.id === r.to);
              const isW = sEl?.status === "withdrawn" || tEl?.status === "withdrawn";
              // Edge endpoints are inset from each node's centre by the node radius so
              // the arrowhead lands on the node border rather than inside the node.
              const sr = sEl?.type === "principle" ? 28 : sEl?.type === "theory" ? 22 : 18;
              const tr = tEl?.type === "principle" ? 28 : tEl?.type === "theory" ? 22 : 18;
              const dx = tp.x - sp.x, dy = tp.y - sp.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const color = isW ? C.withdrawn : C[r.type];
              const isSel = r === selectedRel;
              const baseOp = isW ? 0.25 : 0.7;
              const opacity = dimEdge(r) ? baseOp * 0.12 : baseOp;
              // Arrowhead: tip at the inset target edge, base 10px back along the edge direction.
              const ahl = 10, ahw = 5;
              const tipX = tp.x - (dx / dist) * tr;
              const tipY = tp.y - (dy / dist) * tr;
              const bx = tipX - (dx / dist) * ahl;
              const by = tipY - (dy / dist) * ahl;
              const px = -dy / dist, py = dx / dist; // perpendicular unit vector
              const strokeW = isSel ? 3.5 : dimEdge(r) ? 1.5 : 2;
              return (
                <g key={i} opacity={opacity} style={{ transition: TRANSITION }}>
                  {/* Wider invisible stroke for easier hit-testing */}
                  <line
                    x1={sp.x + (dx / dist) * sr} y1={sp.y + (dy / dist) * sr}
                    x2={bx} y2={by}
                    stroke="transparent" strokeWidth={16}
                  />
                  <line
                    x1={sp.x + (dx / dist) * sr} y1={sp.y + (dy / dist) * sr}
                    x2={bx} y2={by}
                    stroke={color}
                    strokeWidth={strokeW}
                    strokeDasharray={r.type === "conflicts" ? "8,4" : r.type === "undermines" ? "4,4" : "none"}
                  />
                  <polygon
                    points={`${tipX},${tipY} ${bx + px * ahw},${by + py * ahw} ${bx - px * ahw},${by - py * ahw}`}
                    fill={color}
                  />
                </g>
              );
            })}
            {visibleEls.map(e => {
              const pos = positions[e.id];
              if (!pos) return null;
              const isW = e.status === "withdrawn";
              const isSel = e.id === selected;
              const { fill, stroke } = getColors(e);
              const op = isW ? 0.25 : confOp[e.confidence];
              const nodeOp = dimNode(e.id) ? 0.12 : op;
              const r = e.type === "principle" ? 28 : e.type === "theory" ? 22 : 18;
              return (
                <g key={e.id} transform={`translate(${pos.x},${pos.y})`}
                  style={{ cursor: isDragging ? "grabbing" : "pointer", transition: TRANSITION, opacity: nodeOp }}
                  onMouseEnter={(ev) => {
                    if (isDragging) return;
                    const rect = ev.currentTarget.closest("svg").getBoundingClientRect();
                    setTooltip({ x: ev.clientX - rect.left, y: ev.clientY - rect.top - 10, el: e });
                  }}
                  onMouseLeave={() => setTooltip(null)}>
                  {/* White ring drawn behind the node shape to indicate selection. */}
                  {isSel && (
                    <circle r={r + 8} fill="none" stroke="#fff" strokeWidth={2} opacity={0.45} />
                  )}
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
      {/* Tooltip rendered as an HTML div (not SVG) so it can overflow the SVG bounds. */}
      {tooltip && (
        <div style={{
          position: "absolute", left: tooltip.x, top: tooltip.y,
          transform: "translate(-50%, -100%)",
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 6, padding: "8px 12px", maxWidth: 300,
          pointerEvents: "none", zIndex: 10,
        }}>
          <div style={{ color: C.text, fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>
            {tooltip.el.id} ({tooltip.el.type}) — {tooltip.el.status}
          </div>
          <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.4 }}>{tooltip.el.text}</div>
          {tooltip.el.previousText && (
            <div style={{ color: C.revised, fontSize: 10, marginTop: 4, fontStyle: "italic" }}>Previously: {tooltip.el.previousText}</div>
          )}
          {tooltip.el.reason && (
            <div style={{ color: C.withdrawnMark, fontSize: 10, marginTop: 4, fontStyle: "italic" }}>Withdrawn: {tooltip.el.reason}</div>
          )}
          <div style={{ color: C.dim, fontSize: 10, marginTop: 4 }}>Confidence: {tooltip.el.confidence} · Origin: {tooltip.el.origin}</div>
        </div>
      )}
    </div>
  );
}
