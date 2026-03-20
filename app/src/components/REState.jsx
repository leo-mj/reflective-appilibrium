/**
 * @fileoverview Root application component — state management and layout.
 * @module components/REState
 */

/** @import { REState as REStateType } from '../types.js' */

import { useState } from "react";
import { C } from "../constants/colors.js";
import { useStablePositions } from "../hooks/useStablePositions.js";
import { useWindowSize } from "../hooks/useWindowSize.js";
import { SAMPLE_STATE } from "../state.js";
import { Graph } from "./Graph.jsx";
import { TextTab } from "./TextTab.jsx";
import { HistoryTab } from "./HistoryTab.jsx";
import { Legend } from "./Legend.jsx";

/**
 * Root component of the RE visualisation app.
 *
 * ### Responsibilities
 * - Owns all top-level UI state: active tab, show-withdrawn toggle, text-panel
 *   visibility, selected element, and the current history round.
 * - Runs the shared force simulation via {@link module:hooks/useStablePositions}
 *   and passes the resulting `positions` map to both `Graph` and `HistoryTab`.
 * - Computes a **round-filtered state** for `TextTab` when the History tab is
 *   active so the text panel shows only what was visible at the displayed round.
 * - Implements the split-panel layout: graph/history on the left, text panel on
 *   the right (or stacked below on narrow/mobile screens).
 *
 * ### Layout
 * ```
 * ┌─────────────────────────────────────────┐
 * │  Header (title · toggle · tab buttons)  │
 * ├─────────────────────┬───────────────────┤
 * │  Legend             │                   │
 * ├─────────────────────┤   Text panel      │
 * │  Graph or History   │   (optional)      │
 * └─────────────────────┴───────────────────┘
 * ```
 * On screens narrower than 768 px, the text panel stacks below the graph
 * with a fixed height of 280 px.
 *
 * ### Simulation dimensions
 * The force simulation needs to know the graph panel's dimensions (not the full
 * window) so that nodes are centred in the visible area.  These are computed
 * analytically from `dims.w`, `showText`, and known padding/gap constants rather
 * than via a ResizeObserver, which avoids a one-frame bootstrap delay.
 *
 * @returns {React.ReactElement}
 */
export default function REState() {
  /** @type {'graph'|'history'} */
  const [tab, setTab] = useState("graph");
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [showText, setShowText] = useState(true);
  /** Current round shown in the History tab; kept here so TextTab can be filtered to match. */
  const [historyRound, setHistoryRound] = useState(0);
  /** ID of the selected graph node, or null. Shared between Graph (click) and TextTab (badge click). */
  const [selected, setSelected] = useState(null);

  /** @type {REStateType} */
  const state = SAMPLE_STATE;
  const dims = useWindowSize();
  const isWide = dims.w > 768;

  // Compute the graph panel's width directly so the force simulation centres nodes correctly.
  // padding: 16px each side (32 total), gap: 12px, text panel: 50% of the padded container.
  const padded = dims.w - 32;
  const graphW = isWide && showText ? padded / 2 - 12 : padded;
  const simDims = { w: graphW, h: dims.h };
  const { positions, ready } = useStablePositions(state, simDims);

  /**
   * When the History tab is active, build a view of the state that contains only
   * elements and relations that existed at `historyRound`.  This keeps the text
   * panel in sync with the graph slider.
   *
   * When the Graph tab is active, the full state is passed through unchanged.
   *
   * @type {REStateType}
   */
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
      // Fade the whole app in once the simulation has settled to avoid a flash of scrambled nodes.
      opacity: ready ? 1 : 0, transition: "opacity 0.6s ease",
    }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: "bold" }}>RE State — Round {state.round}</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{state.topic}</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* Tab buttons + text-panel toggle */}
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

      {/* ── Body: split panel ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: isWide ? "row" : "column", gap: 12 }}>

        {/* Left / top: legend + graph or history tab */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Legend />
          {/* Show withdrawn toggle */}
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
          <div style={{ flex: 1, minHeight: 0, marginTop: 4 }}>
            {tab === "graph" && (
              <Graph state={state} showWithdrawn={showWithdrawn} positions={positions}
                selected={selected} onSelect={setSelected} />
            )}
            {tab === "history" && (
              <HistoryTab state={state} positions={positions} onRoundChange={setHistoryRound} />
            )}
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
            <TextTab state={textState} showWithdrawn={showWithdrawn}
              selected={selected} onSelect={setSelected} />
          </div>
        )}

      </div>
    </div>
  );
}
