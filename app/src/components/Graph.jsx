import { useState, useRef } from "react";
import { C, confOp, TRANSITION, getColors } from "../constants/colors.js";
import { useContainerDims } from "../hooks/useContainerDims.js";
import { NodeShape } from "./NodeShape.jsx";
import { ArrowDefs } from "./ArrowDefs.jsx";

// Returns all element IDs connected to `selectedId` via any visible relation.
function getNeighbours(selectedId, visRels) {
  const ids = new Set([selectedId]);
  visRels.forEach(r => {
    if (r.from === selectedId) ids.add(r.to);
    if (r.to === selectedId) ids.add(r.from);
  });
  return ids;
}

// Renders the main force-directed graph: directed edges with arrowheads, shaped nodes,
// and a hover tooltip showing element detail. Withdrawn elements and edges are hidden
// unless showWithdrawn is true, in which case they appear at reduced opacity.
// Supports pan by dragging (mouse and touch via Pointer Events API).
// Click a node to highlight it and its neighbours; click background to deselect.
export function Graph({ state, showWithdrawn, positions, selected, onSelect }) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  const [tooltip, setTooltip] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const clickOrigin = useRef(null); // pointer-down position, used to detect drag vs click

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX - pan.x, py: e.clientY - pan.y };
    clickOrigin.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    setTooltip(null);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setPan({ x: e.clientX - dragRef.current.px, y: e.clientY - dragRef.current.py });
  };
  const onPointerUp = (e) => {
    dragRef.current = null;
    setIsDragging(false);
    if (!clickOrigin.current) return;
    const dx = e.clientX - clickOrigin.current.x;
    const dy = e.clientY - clickOrigin.current.y;
    clickOrigin.current = null;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) return; // was a drag, not a click

    // Hit-test all visible nodes in simulation space.
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left - pan.x;
    const sy = e.clientY - rect.top - pan.y;
    let hit = null;
    for (const el of visibleEls) {
      const pos = positions[el.id];
      if (!pos) continue;
      const hitR = el.type === "principle" ? 36 : el.type === "theory" ? 30 : 24;
      if ((pos.x - sx) ** 2 + (pos.y - sy) ** 2 < hitR ** 2) { hit = el.id; break; }
    }
    onSelect(prev => prev === hit ? null : hit);
  };

  const visibleEls = showWithdrawn ? state.elements : state.elements.filter(e => e.status !== "withdrawn");
  const visIds = new Set(visibleEls.map(e => e.id));
  const visRels = state.relations.filter(r => visIds.has(r.from) && visIds.has(r.to));

  // When a node is selected, compute the set of highlighted IDs and dim everything else.
  const highlightedIds = selected ? getNeighbours(selected, visRels) : null;
  const dimNode = (id) => highlightedIds && !highlightedIds.has(id);
  const dimEdge = (r) => highlightedIds && r.from !== selected && r.to !== selected;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {dims.w > 0 && (
        <svg width={dims.w} height={dims.h}
          style={{ background: C.bg, borderRadius: 8, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          <ArrowDefs prefix="" />
          <g transform={`translate(${pan.x},${pan.y})`}>
            {visRels.map((r, i) => {
              const sp = positions[r.from], tp = positions[r.to];
              if (!sp || !tp) return null;
              const sEl = state.elements.find(e => e.id === r.from);
              const tEl = state.elements.find(e => e.id === r.to);
              const isW = sEl?.status === "withdrawn" || tEl?.status === "withdrawn";
              const sr = sEl?.type === "principle" ? 28 : sEl?.type === "theory" ? 22 : 18;
              const tr = tEl?.type === "principle" ? 28 : tEl?.type === "theory" ? 22 : 18;
              const dx = tp.x - sp.x, dy = tp.y - sp.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const baseOp = isW ? 0.25 : 0.7;
              const opacity = dimEdge(r) ? baseOp * 0.12 : baseOp;
              return (
                <line key={i}
                  x1={sp.x + (dx / dist) * sr} y1={sp.y + (dy / dist) * sr}
                  x2={tp.x - (dx / dist) * tr} y2={tp.y - (dy / dist) * tr}
                  stroke={isW ? C.withdrawn : C[r.type]}
                  strokeWidth={dimEdge(r) ? 1.5 : 2}
                  strokeDasharray={r.type === "conflicts" ? "8,4" : r.type === "undermines" ? "4,4" : "none"}
                  markerEnd={`url(#a-${r.type}${isW ? "-w" : ""})`}
                  opacity={opacity}
                  style={{ transition: TRANSITION }}
                />
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
                  {/* Selection ring around the clicked node */}
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
