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
  const logRef        = useRef();
  const currentLogRef = useRef();

  // ── Pan ───────────────────────────────────────────────────────────────────

  const { pan, isDragging, onPointerDown, onPointerMove, onPointerUp } = usePan();

  // ── Playback state ────────────────────────────────────────────────────────

  const [displayRound, setDisplayRound] = useState(0);
  const [targetRound,  setTargetRound]  = useState(0);
  const [playing,      setPlaying]      = useState(false);
  const [speed,        setSpeed]        = useState(1);
  /** Ref copy of `playing` so the interval callback reads the latest value. */
  const playRef  = useRef(false);
  const animRef  = useRef(null);
  const maxRound = state.round;

  /** Available speed multipliers with display labels. */
  const SPEEDS = [0.5, 1, 2, 4];

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

  /** Auto-advances `targetRound` at the current speed while playing. */
  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      if (!playRef.current) return;
      setTargetRound(prev => {
        if (prev >= maxRound) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, 3200 / speed);
    return () => clearInterval(iv);
  }, [playing, maxRound, speed]);

  const snappedRound = Math.round(displayRound);
  useEffect(() => { onRoundChange?.(snappedRound); }, [snappedRound]);

  /** Scroll the log container so the current round entry stays in view. */
  useEffect(() => {
    if (currentLogRef.current && logRef.current) {
      currentLogRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [snappedRound]);

  // ── Derived round data ────────────────────────────────────────────────────

  const { withdrawn } = elementsAtRound(state.elements, snappedRound);
  const wIds = new Set(withdrawn.map(e => e.id));
  const newIds = new Set(
    snappedRound > 0
      ? state.elements.filter(e => e.addedRound === snappedRound).map(e => e.id)
      : []
  );

  // Always render ALL elements and relations; control visibility via opacity so
  // CSS transitions fire smoothly when elements enter or leave the current round.
  const allElements = state.elements;
  const allRels = state.relations;

  // Ascending order: past entries at top, future entries (opacity 0) at bottom.
  const sortedLog = [...state.log].sort((a, b) => a.round - b.round);
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

        <div style={{ display: "flex", gap: 2 }}>
          {SPEEDS.map(s => (
            <button key={s} onClick={() => setSpeed(s)} style={{
              background: speed === s ? C.border : "transparent",
              border: `1px solid ${speed === s ? C.dim : C.border}`,
              color: speed === s ? C.text : C.dim,
              borderRadius: 4, padding: "2px 6px",
              cursor: "pointer", fontSize: 11,
            }}>{s}×</button>
          ))}
        </div>

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

      {/* ── Graph SVG ── */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {dims.w > 0 && (
          <svg width={dims.w} height={dims.h}
            style={{ background: C.bg, borderRadius: 8, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
            <g transform={`translate(${pan.x},${pan.y})`}>

              {/* ── Edges ── */}
              {allRels.map((r, i) => {
                const sp = positions[r.from], tp = positions[r.to];
                if (!sp || !tp) return null;
                const sEl    = state.elements.find(e => e.id === r.from);
                const tEl    = state.elements.find(e => e.id === r.to);
                const future = (r.addedRound || 1) > snappedRound;
                const isW    = wIds.has(r.from) || wIds.has(r.to);
                const color  = isW ? C.withdrawn : C[r.type];
                const { x1, y1, x2, y2, tipX, tipY, perpX, perpY } = arrowGeometry(
                  sp, tp, nodeRadius(sEl?.type), nodeRadius(tEl?.type)
                );
                return (
                  <g key={i} style={{ opacity: future ? 0 : isW ? 0.25 : 0.7, transition: future ? "none" : "opacity 2.2s ease-in-out" }}>
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
              {allElements.map(e => {
                const pos = positions[e.id];
                if (!pos) return null;
                const future = e.addedRound > snappedRound;
                const isW    = wIds.has(e.id);
                const isNew  = newIds.has(e.id);
                const { fill, stroke } = getColors(isW ? { ...e, status: "withdrawn" } : e);
                const op = future ? 0 : isW ? 0.25 : confOp[e.confidence];
                const r  = nodeRadius(e.type);
                return (
                  <g key={e.id} transform={`translate(${pos.x},${pos.y})`}
                    style={{ opacity: op, transition: future ? "none" : "opacity 2.2s ease-in-out", cursor: isDragging ? "grabbing" : "pointer" }}
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

        {/* Log overlay — absolutely positioned so the graph layout is unaffected. */}
        {snappedRound > 0 && sortedLog.length > 0 && (
          <div ref={logRef} className="history-log" style={{
            position: "absolute", top: 10, left: 10,
            width: 260, maxHeight: 130, overflowY: "auto",
            background: `${C.panel}cc`, backdropFilter: "blur(4px)",
            border: `1px solid ${C.border}`, borderRadius: 8,
            padding: "6px 8px",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            {sortedLog.map(entry => {
              const isCurrent = entry.round === snappedRound;
              const isFuture  = entry.round > snappedRound;
              return (
                <div key={entry.round} ref={isCurrent ? currentLogRef : null} style={{
                  flexShrink: 0, fontSize: 11, lineHeight: 1.6,
                  padding: "4px 6px", borderRadius: 5,
                  background: isCurrent ? `${C.supports}22` : "transparent",
                  border: isCurrent ? `1px solid ${C.supports}55` : "1px solid transparent",
                  color: isCurrent ? C.text : C.dim,
                  opacity: isFuture ? 0 : 1,
                  transition: isFuture ? "none" : "opacity 2.2s ease-in-out",
                  pointerEvents: isFuture ? "none" : "auto",
                }}>
                  <span style={{ fontWeight: "bold", color: isCurrent ? C.supports : C.dim }}>
                    Round {entry.round}:
                  </span>{" "}
                  {entry.changes}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
