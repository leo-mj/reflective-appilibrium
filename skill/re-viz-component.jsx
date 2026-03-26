// RE State Visualization Component
// Used by the RE Skill. Do not modify the component code.
// When generating the artifact, replace SAMPLE_STATE with the current real state data.

import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import _dummyState from "./dummy-state.js";

// ============================================================
// REPLACE THIS OBJECT WITH CURRENT STATE DATA WHEN GENERATING
// ============================================================
const _inlineState = {
  topic: "",
  phase: 0,
  round: 0,
  elements: [
    // { id: "J1", type: "judgment", status: "active", confidence: "high", origin: "user", text: "...", addedRound: 1 },
    // { id: "P1", type: "principle", status: "active", confidence: "moderate", origin: "user", text: "...", addedRound: 1 },
    // { id: "T1", type: "theory", status: "active", confidence: "high", origin: "assistant-suggested → user-adopted", text: "...", addedRound: 5 },
    // For revised elements, add: previousText: "...", revisedRound: N
    // For withdrawn elements, add: reason: "...", withdrawnRound: N
  ],
  relations: [
    // { from: "J1", to: "P1", type: "supports", explanation: "...", addedRound: 1 },
    // types: "supports", "conflicts", "undermines", "depends"
  ],
  coherence: {
    tensions: [],
    orphans: [],
    clusters: []
  },
  log: [
    // { round: 1, findings: "...", options: "...", decision: "...", changes: "..." }
  ]
};
// ============================================================
const SAMPLE_STATE = import.meta.env.VITE_USE_DUMMY_STATE ? _dummyState : _inlineState;

const C = {
  bg: "#0f172a",
  panel: "#1e293b",
  border: "#334155",
  text: "#e2e8f0",
  dim: "#94a3b8",
  judgment: { high: "#2563eb", moderate: "#60a5fa", low: "#93c5fd" },
  principle: { high: "#7c3aed", moderate: "#a78bfa", low: "#c4b5fd" },
  theory: { high: "#d97706", moderate: "#fbbf24", low: "#fcd34d" },
  withdrawn: "#64748b",
  supports: "#06b6d4",
  conflicts: "#f97316",
  undermines: "#eab308",
  depends: "#6b7280",
  added: "#06b6d4",
  revised: "#eab308",
  withdrawnMark: "#f97316",
};

// Opacity by confidence level, used for node fills.
const confOp = { high: 1, moderate: 0.75, low: 0.5 };
// CSS transition string applied to nodes and edges for smooth show/hide animations.
const TRANSITION = "opacity 1.2s ease-in-out";

// Hook: tracks the pixel width and height of a DOM element, updating on resize.
function useContainerDims(ref) {
  const [dims, setDims] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const measure = () => {
      if (ref.current) {
        const { clientWidth, clientHeight } = ref.current;
        setDims({ w: clientWidth || 700, h: Math.max(400, clientHeight) });
      }
    };
    measure();
    const timer = setTimeout(measure, 50);
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => { clearTimeout(timer); ro.disconnect(); };
  }, [ref]);
  return dims;
}

// Hook: runs a D3 force-directed simulation over all elements (including withdrawn)
// and returns stable {x, y} positions keyed by element ID. Positions persist across
// tab switches and the show-withdrawn toggle so nodes don't jump around.
function useStablePositions(state, dims) {
  const posRef = useRef({});
  const simRef = useRef(null);
  const [positions, setPositions] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!dims.w || !dims.h) return;
    const allEls = state.elements;
    const allRels = state.relations;

    const nodes = allEls.map(e => {
      const prev = posRef.current[e.id];
      return {
        id: e.id, type: e.type,
        r: e.type === "principle" ? 28 : e.type === "theory" ? 22 : 18,
        x: prev?.x ?? dims.w / 2 + (Math.random() - 0.5) * 200,
        y: prev?.y ?? dims.h / 2 + (Math.random() - 0.5) * 200,
        vx: 0, vy: 0,
      };
    });

    const links = allRels.map(r => ({ source: r.from, target: r.to }));

    if (simRef.current) simRef.current.stop();

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(110).strength(0.4))
      .force("charge", d3.forceManyBody().strength(-320))
      .force("center", d3.forceCenter(dims.w / 2, dims.h / 2))
      .force("collision", d3.forceCollide().radius(d => d.r + 12))
      .force("x", d3.forceX(dims.w / 2).strength(0.04))
      .force("y", d3.forceY(dims.h / 2).strength(0.04))
      .alphaDecay(0.01);

    sim.on("tick", () => {
      const p = {};
      nodes.forEach(n => { p[n.id] = { x: n.x, y: n.y }; });
      posRef.current = p;
      setPositions({ ...p });
    });

    sim.on("end", () => setReady(true));
    setTimeout(() => setReady(true), 1500);

    simRef.current = sim;
    return () => sim.stop();
  }, [state.elements.length, state.relations.length, dims.w, dims.h]);

  return { positions, ready };
}

// Renders the correct SVG shape for an element's type:
//   judgment  → circle, principle → rounded rect, theory → diamond.
function NodeShape({ e, r, fill, stroke, op }) {
  if (e.type === "principle") {
    const rw = r * 2.2, rh = r * 1.5;
    return <rect width={rw} height={rh} x={-rw / 2} y={-rh / 2} rx={8} fill={fill} stroke={stroke} strokeWidth={2} opacity={op} />;
  }
  if (e.type === "theory") {
    return <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} fill={fill} stroke={stroke} strokeWidth={2} opacity={op} />;
  }
  return <circle r={r} fill={fill} stroke={stroke} strokeWidth={2} opacity={op} />;
}

// Returns { fill, stroke } colors for a node based on type, confidence, and withdrawn status.
function getColors(e) {
  const isW = e.status === "withdrawn";
  if (isW) return { fill: C.withdrawn, stroke: C.withdrawn };
  if (e.type === "judgment") return { fill: C.judgment[e.confidence], stroke: C.judgment.high };
  if (e.type === "principle") return { fill: C.principle[e.confidence], stroke: C.principle.high };
  return { fill: C.theory[e.confidence], stroke: C.theory.high };
}

// Defines SVG <marker> arrowheads for every relation type (supports/conflicts/undermines/depends)
// in both normal and withdrawn variants. The prefix keeps IDs unique between the Graph and
// History SVGs so they don't collide in the same document.
function ArrowDefs({ prefix }) {
  return (
    <defs>
      {["supports", "conflicts", "undermines", "depends"].map(t =>
        [false, true].map(w => (
          <marker key={`${prefix}-${t}-${w}`} id={`${prefix}a-${t}${w ? "-w" : ""}`}
            viewBox="0 -5 10 10" refX={10} refY={0}
            markerWidth={6} markerHeight={6} orient="auto">
            <path d="M0,-5L10,0L0,5" fill={w ? C.withdrawn : C[t]} opacity={w ? 0.3 : 1} />
          </marker>
        ))
      )}
    </defs>
  );
}

// Renders the main force-directed graph: directed edges with arrowheads, shaped nodes,
// and a hover tooltip showing element detail. Withdrawn elements and edges are hidden
// unless showWithdrawn is true, in which case they appear at reduced opacity.
function Graph({ state, showWithdrawn, positions }) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  const [tooltip, setTooltip] = useState(null);

  const visibleEls = showWithdrawn ? state.elements : state.elements.filter(e => e.status !== "withdrawn");
  const visIds = new Set(visibleEls.map(e => e.id));
  const visRels = state.relations.filter(r => visIds.has(r.from) && visIds.has(r.to));

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      {dims.w > 0 && (
        <svg width={dims.w} height={dims.h} style={{ background: C.bg, borderRadius: 8 }}>
          <ArrowDefs prefix="" />
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
            return (
              <line key={i}
                x1={sp.x + (dx / dist) * sr} y1={sp.y + (dy / dist) * sr}
                x2={tp.x - (dx / dist) * tr} y2={tp.y - (dy / dist) * tr}
                stroke={isW ? C.withdrawn : C[r.type]}
                strokeWidth={2}
                strokeDasharray={r.type === "conflicts" ? "8,4" : r.type === "undermines" ? "4,4" : "none"}
                markerEnd={`url(#a-${r.type}${isW ? "-w" : ""})`}
                opacity={isW ? 0.25 : 0.7}
                style={{ transition: TRANSITION }}
              />
            );
          })}
          {visibleEls.map(e => {
            const pos = positions[e.id];
            if (!pos) return null;
            const isW = e.status === "withdrawn";
            const { fill, stroke } = getColors(e);
            const op = isW ? 0.25 : confOp[e.confidence];
            const r = e.type === "principle" ? 28 : e.type === "theory" ? 22 : 18;
            return (
              <g key={e.id} transform={`translate(${pos.x},${pos.y})`} style={{ cursor: "pointer", transition: TRANSITION }}
                onMouseEnter={(ev) => {
                  const rect = ev.currentTarget.closest("svg").getBoundingClientRect();
                  setTooltip({ x: ev.clientX - rect.left, y: ev.clientY - rect.top - 10, el: e });
                }}
                onMouseLeave={() => setTooltip(null)}>
                <NodeShape e={e} r={r} fill={fill} stroke={stroke} op={op} />
                <text textAnchor="middle" dy="0.35em" fill={isW ? "#666" : "#fff"}
                  fontSize={e.type === "principle" ? 13 : 11} fontWeight="bold"
                  style={{ textDecoration: isW ? "line-through" : "none", pointerEvents: "none" }}>
                  {e.id}
                </text>
              </g>
            );
          })}
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

// Renders the History tab: a play/pause slider that animates the RE process round by round.
// Elements and relations appear at the round they were added and disappear when withdrawn.
// Newly added elements pulse briefly. A log entry summary is shown below the controls.
function HistoryTab({ state, positions }) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  const [displayRound, setDisplayRound] = useState(0);
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
          <svg width={dims.w} height={dims.h} style={{ background: C.bg, borderRadius: 8 }}>
            <ArrowDefs prefix="h" />
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
                  style={{ opacity: op, transition: "opacity 1.4s ease-in-out", cursor: "pointer" }}
                  onMouseEnter={(ev) => {
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

// Renders the Text tab: a plain-text structured dump of the full RE state — judgments,
// principles, theories, relations, coherence summary, and round log. Useful for copying
// or reading without the graph.
function TextTab({ state, showWithdrawn }) {
  const visibleEls = showWithdrawn ? state.elements : state.elements.filter(e => e.status !== "withdrawn");
  const visIds = new Set(visibleEls.map(e => e.id));
  const renderEl = (e) => {
    let st = e.status;
    if (e.status === "withdrawn") st = `withdrawn — ${e.reason || "no reason"}`;
    if (e.status === "revised" && e.previousText) st = `revised, from: "${e.previousText}"`;
    return `  ${e.id} [${st}, ${e.confidence}, ${e.origin}]: "${e.text}"`;
  };
  const j = visibleEls.filter(e => e.type === "judgment");
  const p = visibleEls.filter(e => e.type === "principle");
  const t = visibleEls.filter(e => e.type === "theory");
  const pCovers = {};
  p.forEach(pr => { pCovers[pr.id] = []; });
  state.relations.forEach(r => {
    if (!visIds.has(r.from) || !visIds.has(r.to)) return;
    const f = state.elements.find(e => e.id === r.from);
    const to = state.elements.find(e => e.id === r.to);
    if (f?.type === "principle" && to?.type === "judgment" && r.type === "supports") pCovers[f.id]?.push(to.id);
    if (to?.type === "principle" && f?.type === "judgment" && r.type === "supports") pCovers[to.id]?.push(f.id);
  });
  const visRels = state.relations.filter(r => visIds.has(r.from) && visIds.has(r.to));
  let tx = `Topic: ${state.topic}\nPhase: ${state.phase} | Round: ${state.round}\n\n`;
  tx += "JUDGMENTS\n" + j.map(renderEl).join("\n") + "\n\n";
  tx += "PRINCIPLES\n" + p.map(pr => renderEl(pr) + (pCovers[pr.id]?.length ? `\n    covers: ${pCovers[pr.id].join(", ")}` : "")).join("\n") + "\n\n";
  if (t.length) tx += "BACKGROUND THEORIES\n" + t.map(renderEl).join("\n") + "\n\n";
  tx += "RELATIONS\n" + visRels.map(r => `  ${r.from} → ${r.type} → ${r.to}: ${r.explanation}`).join("\n") + "\n\n";
  tx += "COHERENCE\n";
  tx += `  Tensions: ${state.coherence.tensions.join("; ") || "None"}\n`;
  tx += `  Orphans: ${state.coherence.orphans.join("; ") || "None"}\n`;
  tx += `  Clusters: ${state.coherence.clusters.join("; ") || "None"}\n\n`;
  tx += "LOG\n" + state.log.map(l => `  Round ${l.round}: ${l.findings} ${l.decision !== "—" ? `Decision: ${l.decision}` : ""}`).join("\n");
  return (
    <pre style={{
      background: C.bg, color: C.dim, padding: 20, borderRadius: 8,
      fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
      overflowY: "auto", height: "100%", margin: 0,
    }}>{tx}</pre>
  );
}

// Renders the color/shape legend bar shown above all tabs.
function Legend() {
  const items = [
    { label: "Judgment (high)", shape: "circle", color: "#2563eb" },
    { label: "Judgment (mod)", shape: "circle", color: "#60a5fa" },
    { label: "Judgment (low)", shape: "circle", color: "#93c5fd" },
    { label: "Principle", shape: "roundrect", color: "#7c3aed" },
    { label: "Theory", shape: "diamond", color: "#d97706" },
    { label: "Withdrawn", shape: "circle", color: "#64748b", faded: true },
  ];
  const lines = [
    { label: "Supports", color: C.supports, dash: "" },
    { label: "Conflicts", color: C.conflicts, dash: "8,4" },
    { label: "Undermines", color: C.undermines, dash: "4,4" },
  ];
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "6px 0", fontSize: 11, color: C.dim }}>
      {items.map(it => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 4, opacity: it.faded ? 0.4 : 1 }}>
          {it.shape === "circle" && <div style={{ width: 10, height: 10, borderRadius: "50%", background: it.color }} />}
          {it.shape === "roundrect" && <div style={{ width: 14, height: 10, borderRadius: 3, background: it.color }} />}
          {it.shape === "diamond" && <svg width={12} height={12} viewBox="0 0 12 12"><polygon points="6,0 12,6 6,12 0,6" fill={it.color} /></svg>}
          {it.label}
        </div>
      ))}
      {lines.map(l => (
        <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width={20} height={10}><line x1={0} y1={5} x2={20} y2={5} stroke={l.color} strokeWidth={2} strokeDasharray={l.dash} /></svg>
          {l.label}
        </div>
      ))}
    </div>
  );
}

// Root component. Manages tab state and the show-withdrawn toggle, runs the shared force
// simulation, and renders the appropriate tab content (Graph / Text / History).
export default function REState() {
  const [tab, setTab] = useState("graph");
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const state = SAMPLE_STATE;
  const dims = { w: 700, h: 450 };
  const { positions, ready } = useStablePositions(state, dims);

  return (
    <div style={{
      background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif",
      height: "100vh", display: "flex", flexDirection: "column", padding: 16,
      opacity: ready ? 1 : 0, transition: "opacity 0.6s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: "bold" }}>RE State — Round {state.round}</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{state.topic}</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {tab !== "history" && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.dim, cursor: "pointer" }}>
              <div onClick={() => setShowWithdrawn(!showWithdrawn)}
                style={{
                  width: 32, height: 18, borderRadius: 9, position: "relative",
                  background: showWithdrawn ? "#7c3aed" : C.border, transition: "background 0.3s", cursor: "pointer",
                }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 7, background: C.text,
                  position: "absolute", top: 2, left: showWithdrawn ? 16 : 2, transition: "left 0.3s ease",
                }} />
              </div>
              Show withdrawn
            </label>
          )}
          <div style={{ display: "flex", gap: 2 }}>
            {["graph", "text", "history"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: tab === t ? "bold" : "normal",
                background: tab === t ? C.border : "transparent",
                color: tab === t ? C.text : C.dim,
              }}>
                {t === "graph" ? "Graph" : t === "text" ? "Text" : "History"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Legend />
      <div style={{ flex: 1, minHeight: 0, marginTop: 4 }}>
        {tab === "graph" && <Graph state={state} showWithdrawn={showWithdrawn} positions={positions} />}
        {tab === "text" && <TextTab state={state} showWithdrawn={showWithdrawn} />}
        {tab === "history" && <HistoryTab state={state} positions={positions} />}
      </div>
    </div>
  );
}