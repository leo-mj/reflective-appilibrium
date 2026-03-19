import { useState } from "react";
import { C } from "../constants/colors.js";
import { useStablePositions } from "../hooks/useStablePositions.js";
import { useWindowSize } from "../hooks/useWindowSize.js";
import { SAMPLE_STATE } from "../state.js";
import { Graph } from "./Graph.jsx";
import { TextTab } from "./TextTab.jsx";
import { HistoryTab } from "./HistoryTab.jsx";
import { Legend } from "./Legend.jsx";

// Root component. Manages tab state and the show-withdrawn toggle, runs the shared force
// simulation, and renders the appropriate tab content (Graph / History) alongside the
// persistent Text panel. On wide screens the text panel is on the right; on narrow screens
// it stacks below.
export default function REState() {
  const [tab, setTab] = useState("graph");
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [showText, setShowText] = useState(true);
  const [historyRound, setHistoryRound] = useState(0);
  const [selected, setSelected] = useState(null);
  const state = SAMPLE_STATE;
  const dims = useWindowSize();
  const isWide = dims.w > 768;
  // Compute the graph panel's width directly so the force simulation centers nodes correctly.
  // padding: 16px each side (32 total), gap: 12px, text panel: 50% of the padded container.
  const padded = dims.w - 32;
  const graphW = isWide && showText ? padded / 2 - 12 : padded;
  const simDims = { w: graphW, h: dims.h };
  const { positions, ready } = useStablePositions(state, simDims);

  // When on the history tab, filter the state down to what's visible at the current round.
  const textState = tab === "history" ? (() => {
    const active = state.elements.filter(e => {
      const added = e.addedRound || 1;
      if (added > historyRound) return false;
      if (e.status === "withdrawn" && e.withdrawnRound && e.withdrawnRound <= historyRound) return false;
      return true;
    });
    const withdrawn = state.elements.filter(e => {
      const added = e.addedRound || 1;
      if (added > historyRound) return false;
      return e.status === "withdrawn" && e.withdrawnRound && e.withdrawnRound <= historyRound;
    });
    const elements = [...active, ...withdrawn];
    const visIds = new Set(elements.map(e => e.id));
    return {
      ...state,
      round: historyRound,
      elements,
      relations: state.relations.filter(r => visIds.has(r.from) && visIds.has(r.to) && (r.addedRound || 1) <= historyRound),
    };
  })() : state;

  return (
    <div style={{
      background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif",
      height: "100vh", display: "flex", flexDirection: "column", padding: 16,
      opacity: ready ? 1 : 0, transition: "opacity 0.6s ease",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: "bold" }}>RE State — Round {state.round}</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{state.topic}</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
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
          <div style={{ display: "flex", gap: 2 }}>
            {["graph", "history"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: tab === t ? "bold" : "normal",
                background: tab === t ? C.border : "transparent",
                color: tab === t ? C.text : C.dim,
              }}>
                {t === "graph" ? "Graph" : "History"}
              </button>
            ))}
            <button onClick={() => setShowText(s => !s)} style={{
              padding: "4px 12px", borderRadius: 4, border: `1px solid ${C.border}`, cursor: "pointer",
              fontSize: 12, background: "transparent", color: showText ? C.text : C.dim, marginLeft: 4,
            }}>
              {showText ? "Hide text" : "Show text"}
            </button>
          </div>
        </div>
      </div>

      {/* Body: split panel */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: isWide ? "row" : "column", gap: 12 }}>

        {/* Left / top: legend + graph or history */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Legend />
          <div style={{ flex: 1, minHeight: 0, marginTop: 4 }}>
            {tab === "graph" && <Graph state={state} showWithdrawn={showWithdrawn} positions={positions} selected={selected} onSelect={setSelected} />}
            {tab === "history" && <HistoryTab state={state} positions={positions} onRoundChange={setHistoryRound} />}
          </div>
        </div>

        {/* Right / bottom: persistent text panel */}
        {showText && (
          <div style={{
            width: isWide ? "50%" : "100%",
            height: isWide ? "auto" : 280,
            flexShrink: 0,
            borderLeft: isWide ? `1px solid ${C.border}` : "none",
            borderTop: isWide ? "none" : `1px solid ${C.border}`,
            paddingLeft: isWide ? 12 : 0,
            paddingTop: isWide ? 0 : 8,
            minHeight: 0,
            overflow: "hidden",
          }}>
            <TextTab state={textState} showWithdrawn={showWithdrawn} selected={selected} onSelect={setSelected} />
          </div>
        )}

      </div>
    </div>
  );
}
