/**
 * @fileoverview Root application component — state management and layout.
 * @module components/REState
 */

/** @import { REState as REStateType } from '../types.js' */

import { useState, lazy, Suspense, useEffect } from "react";
import { C } from "../constants/colors.js";
import { LLM_ENABLED } from "../config.js";
import { useStablePositions } from "../hooks/useStablePositions.js";
import { useWindowSize } from "../hooks/useWindowSize.js";
import { elementsAtRound, nextElementId, makeDiff, makeLogEntry } from "../utils/stateUtils.js";
import { Graph } from "./Graph.jsx";
import { TextTab } from "./TextTab.jsx";
import { HistoryTab } from "./HistoryTab.jsx";
import { Legend } from "./Legend.jsx";

import { EditModal } from "./EditModal.jsx";
import { EditRelationModal } from "./EditRelationModal.jsx";
import { AddElementModal } from "./AddElementModal.jsx";
import { AddRelationModal } from "./AddRelationModal.jsx";

// Loaded only in LLM-enabled builds; tree-shaken (with the openai SDK) in public builds.
const CoherenceMatrixTab = LLM_ENABLED
  ? lazy(() => import("./CoherenceMatrixTab.jsx").then(m => ({ default: m.CoherenceMatrixTab })))
  : null;

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
/**
 * @param {Object}      props
 * @param {REStateType} props.initialState
 * @param {Function}    props.onHome    - Called when the user navigates back to the home screen.
 * @param {Function}    props.onReady   - Called once the force simulation has settled.
 */
export default function REState({ initialState, onHome, onReady }) {
  /** @type {'graph'|'history'} */
  const [tab, setTab] = useState("graph");
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [showText, setShowText] = useState(true);
  /** Current round shown in the History tab; kept here so TextTab can be filtered to match. */
  const [historyRound, setHistoryRound] = useState(0);
  /** ID of the selected graph node, or null. Shared between Graph (click) and TextTab (badge click). */
  const [selected, setSelected] = useState(null);
  /** The selected relation object, or null. Mutually exclusive with `selected`. */
  const [selectedRel, setSelectedRel] = useState(null);

  /** Select a node; clears any selected relation. */
  const handleSelectNode = (updater) => {
    setSelectedRel(null);
    setSelected(updater);
  };

  /** Select a relation; clears any selected node. */
  const handleSelectRel = (updater) => {
    setSelected(null);
    setSelectedRel(updater);
  };

  /** @type {REStateType} The mutable RE state; editing saves a new round into this. */
  const [state, setState] = useState(initialState);
  /** The element currently open in the edit modal, or null when the modal is closed. */
  const [editingEl, setEditingEl] = useState(null);

  /**
   * Opens the edit modal for an element. Also ensures it is selected in the graph.
   * @param {string} elementId
   */
  const handleEditRequest = (elementId) => {
    setSelected(elementId);
    setEditingEl(state.elements.find(e => e.id === elementId) ?? null);
  };

  /**
   * Applies edits from the Revise modal as a new round.
   * Always marks the element as `"revised"`, preserving the old text in `previousText`.
   *
   * @param {import('./EditModal.jsx').EditFormData} formData
   */
  const handleEditSave = (formData) => {
    const newRound = state.round + 1;
    const oldEl = editingEl;
    const newEl = { ...oldEl, ...formData, status: "revised" };
    newEl.previousText = oldEl.text;
    newEl.revisedRound = newRound;
    delete newEl.withdrawnRound;
    delete newEl.reason;

    const diffs = makeDiff(["type", "confidence", "status", "origin", "text"], oldEl, formData);

    setState(prev => ({
      ...prev,
      round: newRound,
      elements: prev.elements.map(e => e.id === oldEl.id ? newEl : e),
      log: [...prev.log, makeLogEntry(
        newRound,
        `${oldEl.id} was edited by the user.`,
        "Changes applied",
        diffs.length ? diffs.join("; ") : "No fields changed",
      )],
    }));
    setEditingEl(null);
  };

  /** The relation currently open in the relation edit modal, or null. */
  const [editingRel, setEditingRel] = useState(null);

  /**
   * @param {import('../types.js').RERelation} rel
   */
  const handleRelEditSave = (formData) => {
    const newRound = state.round + 1;
    const diffs = makeDiff(["type", "explanation"], editingRel, formData);

    setState(prev => ({
      ...prev,
      round: newRound,
      relations: prev.relations.map(r => r === editingRel ? { ...editingRel, ...formData, status: "revised", revisedRound: newRound } : r),
      log: [...prev.log, makeLogEntry(
        newRound,
        `Relation ${editingRel.from} → ${editingRel.to} was edited by the user.`,
        "Changes applied",
        diffs.length ? diffs.join("; ") : "No fields changed",
      )],
    }));
    setEditingRel(null);
  };

  /** @param {string} elementId */
  const handleWithdrawRequest = (elementId) => {
    const newRound = state.round + 1;
    setState(prev => ({
      ...prev,
      round: newRound,
      elements: prev.elements.map(e => e.id === elementId
        ? { ...e, status: "withdrawn", withdrawnRound: newRound, reason: "", previousText: undefined, revisedRound: undefined }
        : e
      ),
      log: [...prev.log, makeLogEntry(
        newRound,
        `${elementId} was withdrawn by the user.`,
        "Withdrawn",
        `${elementId}: status → withdrawn`,
      )],
    }));
  };

  /** @param {import('../types.js').RERelation} rel */
  const handleWithdrawRelRequest = (rel) => {
    const newRound = state.round + 1;
    setState(prev => ({
      ...prev,
      round: newRound,
      relations: prev.relations.map(r => r === rel
        ? { ...r, status: "withdrawn", withdrawnRound: newRound }
        : r
      ),
      log: [...prev.log, makeLogEntry(
        newRound,
        `Relation ${rel.from} → ${rel.to} was withdrawn by the user.`,
        "Withdrawn",
        `${rel.from} → ${rel.to}: status → withdrawn`,
      )],
    }));
  };

  /** Type pre-selected when the Add Element modal is open, or null when closed. */
  const [addingElType, setAddingElType] = useState(null);
  /** True when the Add Relation modal is open. */
  const [addingRel, setAddingRel] = useState(false);

  /** @param {import('./AddElementModal.jsx').AddElementFormData} formData */
  const handleAddElement = (formData) => {
    const newRound = state.round + 1;
    const newId = nextElementId(state.elements, formData.type);
    setState(prev => ({
      ...prev,
      round: newRound,
      elements: [...prev.elements, { id: newId, status: "active", addedRound: newRound, ...formData }],
      log: [...prev.log, makeLogEntry(newRound, `${newId} was added by the user.`, "Added", `${newId} added`)],
    }));
    setAddingElType(null);
    handleSelectNode(() => newId);
  };

  /** @param {import('./AddRelationModal.jsx').AddRelationFormData} formData */
  const handleAddRelation = (formData) => {
    const newRound = state.round + 1;
    const newRel = { ...formData, addedRound: newRound };
    setState(prev => ({
      ...prev,
      round: newRound,
      relations: [...prev.relations, newRel],
      log: [...prev.log, makeLogEntry(
        newRound,
        `Relation ${formData.from} → ${formData.to} was added by the user.`,
        "Added",
        `${formData.from} → ${formData.to} (${formData.type}) added`,
      )],
    }));
    setAddingRel(false);
    handleSelectRel(() => newRel);
  };

  const dims = useWindowSize();
  const isWide = dims.w > 768;

  // Compute the graph panel's width directly so the force simulation centres nodes correctly.
  // padding: 16px each side (32 total), gap: 12px, text panel: 50% of the padded container.
  const padded = dims.w - 32;
  const graphW = isWide && showText ? padded / 2 - 12 : padded;
  const simDims = { w: graphW, h: dims.h };
  const { positions, ready } = useStablePositions(state, simDims);
  useEffect(() => { if (ready) onReady?.(); }, [ready]);

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
    const { active, withdrawn } = elementsAtRound(state.elements, historyRound);
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onHome} style={{
            background: "transparent", border: `1px solid ${C.border}`,
            borderRadius: 4, padding: "3px 8px", fontSize: 11,
            color: C.dim, cursor: "pointer",
          }}>
            ← Home
          </button>
          <div>
            <div style={{ fontSize: 14, fontWeight: "bold" }}>RE State — Round {state.round}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{state.topic}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* Tab buttons + text-panel toggle */}
          <div style={{ display: "flex", gap: 2 }}>
            {["graph", "history", ...(LLM_ENABLED ? ["matrix"] : [])].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: tab === t ? "bold" : "normal",
                background: tab === t ? C.border : "transparent",
                color: tab === t ? C.text : C.dim,
              }}>
                {t === "graph" ? "Graph" : t === "history" ? "History" : "Matrix"}
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
                selected={selected} onSelect={handleSelectNode}
                selectedRel={selectedRel} onSelectRel={handleSelectRel} />
            )}
            {tab === "history" && (
              <HistoryTab state={state} positions={positions} onRoundChange={setHistoryRound} />
            )}
            {tab === "matrix" && LLM_ENABLED && (
              <Suspense fallback={null}>
                <CoherenceMatrixTab state={state} />
              </Suspense>
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
              selected={selected} onSelect={handleSelectNode}
              selectedRel={selectedRel} onSelectRel={handleSelectRel}
              onEditRequest={handleEditRequest} onEditRelRequest={setEditingRel}
              onWithdrawRequest={handleWithdrawRequest} onWithdrawRelRequest={handleWithdrawRelRequest}
              onAddRequest={setAddingElType} onAddRelRequest={() => setAddingRel(true)} />
          </div>
        )}

      </div>

      {editingEl && (
        <EditModal
          element={editingEl}
          currentRound={state.round}
          onSave={handleEditSave}
          onCancel={() => setEditingEl(null)}
        />
      )}
      {editingRel && (
        <EditRelationModal
          relation={editingRel}
          currentRound={state.round}
          onSave={handleRelEditSave}
          onCancel={() => setEditingRel(null)}
        />
      )}
      {addingElType && (
        <AddElementModal
          initialType={addingElType}
          currentRound={state.round}
          onSave={handleAddElement}
          onCancel={() => setAddingElType(null)}
        />
      )}
      {addingRel && (
        <AddRelationModal
          elements={state.elements.filter(e => e.status !== "withdrawn")}
          currentRound={state.round}
          onSave={handleAddRelation}
          onCancel={() => setAddingRel(false)}
        />
      )}
    </div>
  );
}
