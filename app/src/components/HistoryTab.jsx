import { useState, useEffect, useRef } from "react";
import { C, confOp, getColors } from "../constants/colors.js";
import { useContainerDims } from "../hooks/useContainerDims.js";
import { NodeShape } from "./NodeShape.jsx";
import { ArrowDefs } from "./ArrowDefs.jsx";

// Renders the History tab: a play/pause slider that animates the RE process round by round.
// Elements and relations appear at the round they were added and disappear when withdrawn.
// Newly added elements pulse briefly. A log entry summary is shown below the controls.
export function HistoryTab({ state, positions, onRoundChange }) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  const [displayRound, setDisplayRound] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX - pan.x, py: e.clientY - pan.y };
    setIsDragging(true);
    setTooltip(null);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setPan({ x: e.clientX - dragRef.current.px, y: e.clientY - dragRef.current.py });
  };
  const onPointerUp = () => { dragRef.current = null; setIsDragging(false); };
  const [targetRound, setTargetRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const playRef = useRef(false);
  const animRef = useRef(null);
  const maxRound = state.round;

  useEffect(() => { playRef.current = playing; }, [playing]);

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const animate = () => {
      setDisplayRound(prev => {
        const diff = targetRound - prev;
        if (Math.abs(diff) < 0.01) return targetRound;
        const next = prev + diff * 0.08;
        animRef.current = requestAnimationFrame(animate);
        return next;
      });
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [targetRound]);

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

  const visibleAtRound = (round) => {
    const els = state.elements.filter(e => {
      const added = e.addedRound || 1;
      if (added > round) return false;
      if (e.status === "withdrawn" && e.withdrawnRound && e.withdrawnRound <= round) return false;
      return true;
    });
    const withdrawn = state.elements.filter(e => {
      const added = e.addedRound || 1;
      if (added > round) return false;
      return e.status === "withdrawn" && e.withdrawnRound && e.withdrawnRound <= round;
    });
    return { active: els, withdrawn };
  };

  const { active, withdrawn } = visibleAtRound(snappedRound);
  const allVis = [...active, ...withdrawn];
  const visIds = new Set(allVis.map(e => e.id));
  const wIds = new Set(withdrawn.map(e => e.id));
  const visRels = state.relations.filter(r =>
    visIds.has(r.from) && visIds.has(r.to) && (r.addedRound || 1) <= snappedRound
  );
  const newIds = new Set(
    snappedRound > 0 ? state.elements.filter(e => e.addedRound === snappedRound).map(e => e.id) : []
  );

  const logEntry = state.log.find(l => l.round === snappedRound);
  const sliderPct = maxRound > 0 ? (displayRound / maxRound) * 100 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
        <button onClick={() => { setTargetRound(0); setDisplayRound(0); setPlaying(false); }}
          style={{ background: "none", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}>
          Reset
        </button>
        <button onClick={() => {
          if (targetRound >= maxRound) { setTargetRound(0); setDisplayRound(0); }
          setPlaying(!playing);
        }}
          style={{ background: playing ? C.conflicts : C.supports, border: "none", color: "#fff", borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: "bold" }}>
          {playing ? "Pause" : "Play"}
        </button>
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
        <div style={{
          minWidth: 80, textAlign: "center", padding: "4px 10px",
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6,
        }}>
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
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {dims.w > 0 && (
          <svg width={dims.w} height={dims.h}
            style={{ background: C.bg, borderRadius: 8, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
            <ArrowDefs prefix="h" />
            <g transform={`translate(${pan.x},${pan.y})`}>
            {visRels.map((r, i) => {
              const sp = positions[r.from], tp = positions[r.to];
              if (!sp || !tp) return null;
              const sEl = state.elements.find(e => e.id === r.from);
              const tEl = state.elements.find(e => e.id === r.to);
              const isW = wIds.has(r.from) || wIds.has(r.to);
              const sr = sEl?.type === "principle" ? 28 : sEl?.type === "theory" ? 22 : 18;
              const tr = tEl?.type === "principle" ? 28 : tEl?.type === "theory" ? 22 : 18;
              const dx = tp.x - sp.x, dy = tp.y - sp.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              return (
                <line key={i}
                  x1={sp.x + (dx / dist) * sr} y1={sp.y + (dy / dist) * sr}
                  x2={tp.x - (dx / dist) * tr} y2={tp.y - (dy / dist) * tr}
                  stroke={isW ? C.withdrawn : C[r.type]}
                  strokeWidth={2}
                  strokeDasharray={r.type === "conflicts" ? "8,4" : r.type === "undermines" ? "4,4" : "none"}
                  markerEnd={`url(#ha-${r.type}${isW ? "-w" : ""})`}
                  style={{ opacity: isW ? 0.25 : 0.7, transition: "opacity 1.4s ease-in-out" }}
                />
              );
            })}
            {allVis.map(e => {
              const pos = positions[e.id];
              if (!pos) return null;
              const isW = wIds.has(e.id);
              const isNew = newIds.has(e.id);
              const { fill, stroke } = getColors(isW ? { ...e, status: "withdrawn" } : e);
              const op = isW ? 0.25 : confOp[e.confidence];
              const r = e.type === "principle" ? 28 : e.type === "theory" ? 22 : 18;
              return (
                <g key={e.id} transform={`translate(${pos.x},${pos.y})`}
                  style={{ opacity: op, transition: "opacity 1.4s ease-in-out", cursor: isDragging ? "grabbing" : "pointer" }}
                  onMouseEnter={(ev) => {
                    if (isDragging) return;
                    const rect = ev.currentTarget.closest("svg").getBoundingClientRect();
                    setTooltip({ x: ev.clientX - rect.left, y: ev.clientY - rect.top - 10, el: e });
                  }}
                  onMouseLeave={() => setTooltip(null)}>
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
            <div style={{ color: C.dim, fontSize: 10, marginTop: 4 }}>
              Confidence: {tooltip.el.confidence} · Origin: {tooltip.el.origin} · Added: Round {tooltip.el.addedRound || "?"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
