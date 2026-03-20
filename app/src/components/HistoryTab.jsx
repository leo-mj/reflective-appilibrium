/**
 * @fileoverview Animated round-by-round history playback tab.
 * @module components/HistoryTab
 */

/** @import { REState, PositionMap } from '../types.js' */

import { useState, useEffect, useRef } from "react";
import { C, confOp, getColors } from "../constants/colors.js";
import { useContainerDims } from "../hooks/useContainerDims.js";
import { usePan } from "../hooks/usePan.js";
import { nodeRadius, edgeDashArray, arrowGeometry } from "../utils/graphHelpers.js";
import { elementsAtRound } from "../utils/stateUtils.js";
import { NodeShape } from "./NodeShape.jsx";
import { NodeTooltip } from "./NodeTooltip.jsx";

/**
 * Renders the History tab: animated, slider-controlled playback of the RE process
 * round by round.
 *
 * ### How rounds are displayed
 * `displayRound` is a floating-point number that eases toward the integer
 * `targetRound` via a `requestAnimationFrame` loop (exponential smoothing,
 * factor 0.08).  The integer `snappedRound = Math.round(displayRound)` controls
 * which elements and relations are shown.
 *
 * ### Newly-added pulse
 * Elements whose `addedRound` equals `snappedRound` receive a SVG `<animate>`
 * pulse ring so the user can immediately see what changed in the current round.
 *
 * @param {Object}      props
 * @param {REState}     props.state
 * @param {PositionMap} props.positions
 * @param {function(number): void} props.onRoundChange - Notifies parent of the current round.
 * @returns {React.ReactElement}
 */
export function HistoryTab({ state, positions, onRoundChange }) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  const [tooltip, setTooltip] = useState(null);

  // ── Pan ───────────────────────────────────────────────────────────────────

  const { pan, isDragging, onPointerDown, onPointerMove, onPointerUp } = usePan();

  // ── Playback state ────────────────────────────────────────────────────────

  const [displayRound, setDisplayRound] = useState(0);
  const [targetRound,  setTargetRound]  = useState(0);
  const [playing,      setPlaying]      = useState(false);
  /** Ref copy of `playing` so the interval callback reads the latest value. */
  const playRef  = useRef(false);
  const animRef  = useRef(null);
  const maxRound = state.round;

  useEffect(() => { playRef.current = playing; }, [playing]);

  /**
   * Smooth animation loop: eases `displayRound` toward `targetRound`
   * using exponential smoothing (factor 0.08 per frame).
   */
  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const animate = () => {
      setDisplayRound(prev => {
        const diff = targetRound - prev;
        if (Math.abs(diff) < 0.01) return targetRound;
        animRef.current = requestAnimationFrame(animate);
        return prev + diff * 0.08;
      });
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [targetRound]);

  /** Auto-advances `targetRound` every 3.2 s while playing. */
  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      if (!playRef.current) return;
      setTargetRound(prev => {
        if (prev >= maxRound) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, 3200);
    return () => clearInterval(iv);
  }, [playing, maxRound]);

  const snappedRound = Math.round(displayRound);
  useEffect(() => { onRoundChange?.(snappedRound); }, [snappedRound]);

  // ── Derived round data ────────────────────────────────────────────────────

  const { active, withdrawn } = elementsAtRound(state.elements, snappedRound);
  const allVis = [...active, ...withdrawn];
  const visIds = new Set(allVis.map(e => e.id));
  const wIds   = new Set(withdrawn.map(e => e.id));
  const newIds = new Set(
    snappedRound > 0
      ? state.elements.filter(e => e.addedRound === snappedRound).map(e => e.id)
      : []
  );
  const visRels = state.relations.filter(r =>
    visIds.has(r.from) && visIds.has(r.to) && (r.addedRound || 1) <= snappedRound
  );
  const logEntry  = state.log.find(l => l.round === snappedRound);
  const sliderPct = maxRound > 0 ? (displayRound / maxRound) * 100 : 0;

  // ── Helpers ───────────────────────────────────────────────────────────────

  const resetPlayback = () => { setTargetRound(0); setDisplayRound(0); setPlaying(false); };
  const togglePlay = () => {
    if (targetRound >= maxRound) resetPlayback();
    setPlaying(p => !p);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Playback controls ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
        <button onClick={resetPlayback} style={{
          background: "none", border: `1px solid ${C.border}`, color: C.dim,
          borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 12,
        }}>Reset</button>

        <button onClick={togglePlay} style={{
          background: playing ? C.conflicts : C.supports, border: "none",
          color: "#fff", borderRadius: 4, padding: "4px 12px",
          cursor: "pointer", fontSize: 12, fontWeight: "bold",
        }}>{playing ? "Pause" : "Play"}</button>

        {/* Slider: invisible <input type="range"> overlaid on a styled track. */}
        <div style={{ flex: 1, position: "relative", height: 20, display: "flex", alignItems: "center" }}>
          <div style={{ position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2, background: C.border }}>
            <div style={{ width: `${sliderPct}%`, height: "100%", borderRadius: 2, background: C.supports, transition: "width 0.15s linear" }} />
          </div>
          <input type="range" min={0} max={maxRound} step={1} value={targetRound}
            onChange={e => { setTargetRound(Number(e.target.value)); setPlaying(false); }}
            style={{ position: "absolute", left: 0, right: 0, width: "100%", opacity: 0, cursor: "pointer", height: 20 }} />
          {Array.from({ length: maxRound + 1 }, (_, i) => (
            <div key={i} style={{
              position: "absolute", left: `${(i / maxRound) * 100}%`,
              width: 2, height: snappedRound === i ? 12 : 6,
              background: snappedRound === i ? C.supports : C.dim,
              borderRadius: 1, transform: "translateX(-1px)",
              transition: "height 0.3s ease, background 0.3s ease",
            }} />
          ))}
        </div>

        <div style={{ minWidth: 80, textAlign: "center", padding: "4px 10px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <div style={{ fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1 }}>Round</div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: C.text, lineHeight: 1.2 }}>
            {snappedRound === 0 ? "—" : snappedRound}
          </div>
          <div style={{ fontSize: 9, color: C.dim }}>of {maxRound}</div>
        </div>
      </div>

      {logEntry && (
        <div style={{ fontSize: 11, color: C.dim, padding: "4px 0 8px", lineHeight: 1.4, transition: "opacity 0.6s ease" }}>
          <span style={{ color: C.text, fontWeight: "bold" }}>Round {logEntry.round}:</span> {logEntry.changes}
        </div>
      )}

      {/* ── Graph SVG ── */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {dims.w > 0 && (
          <svg width={dims.w} height={dims.h}
            style={{ background: C.bg, borderRadius: 8, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
            <g transform={`translate(${pan.x},${pan.y})`}>

              {/* ── Edges ── */}
              {visRels.map((r, i) => {
                const sp = positions[r.from], tp = positions[r.to];
                if (!sp || !tp) return null;
                const sEl  = state.elements.find(e => e.id === r.from);
                const tEl  = state.elements.find(e => e.id === r.to);
                const isW  = wIds.has(r.from) || wIds.has(r.to);
                const color = isW ? C.withdrawn : C[r.type];
                const { x1, y1, x2, y2, tipX, tipY, perpX, perpY } = arrowGeometry(
                  sp, tp, nodeRadius(sEl?.type), nodeRadius(tEl?.type)
                );
                return (
                  <g key={i} style={{ opacity: isW ? 0.25 : 0.7, transition: "opacity 1.4s ease-in-out" }}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={color} strokeWidth={2}
                      strokeDasharray={edgeDashArray(r.type)} />
                    <polygon
                      points={`${tipX},${tipY} ${x2 + perpX * 5},${y2 + perpY * 5} ${x2 - perpX * 5},${y2 - perpY * 5}`}
                      fill={color} />
                  </g>
                );
              })}

              {/* ── Nodes ── */}
              {allVis.map(e => {
                const pos = positions[e.id];
                if (!pos) return null;
                const isW  = wIds.has(e.id);
                const isNew = newIds.has(e.id);
                const { fill, stroke } = getColors(isW ? { ...e, status: "withdrawn" } : e);
                const op = isW ? 0.25 : confOp[e.confidence];
                const r  = nodeRadius(e.type);
                return (
                  <g key={e.id} transform={`translate(${pos.x},${pos.y})`}
                    style={{ opacity: op, transition: "opacity 1.4s ease-in-out", cursor: isDragging ? "grabbing" : "pointer" }}
                    onMouseEnter={(ev) => {
                      if (isDragging) return;
                      const rect = ev.currentTarget.closest("svg").getBoundingClientRect();
                      setTooltip({ x: ev.clientX - rect.left, y: ev.clientY - rect.top - 10, el: e });
                    }}
                    onMouseLeave={() => setTooltip(null)}>
                    {/* Pulse ring for newly-added elements (SVG SMIL animation). */}
                    {isNew && !isW && (
                      e.type === "principle" ? (
                        <rect width={r * 2.2 + 8} height={r * 1.5 + 8} x={-r * 1.1 - 4} y={-r * 0.75 - 4}
                          rx={10} fill="none" stroke={C.added} strokeWidth={2}>
                          <animate attributeName="opacity" values="0.7;0.15;0.7" dur="2.5s" repeatCount="indefinite" />
                        </rect>
                      ) : (
                        <circle r={r + 5} fill="none" stroke={C.added} strokeWidth={2}>
                          <animate attributeName="opacity" values="0.7;0.15;0.7" dur="2.5s" repeatCount="indefinite" />
                        </circle>
                      )
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
        <NodeTooltip tooltip={tooltip} />
      </div>
    </div>
  );
}
