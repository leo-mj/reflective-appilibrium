/**
 * @fileoverview Root application component — state management and layout.
 * @module components/REState
 */

/** @import { REState as REStateType } from '../types.js' */

import { useState, useRef, lazy, Suspense, useEffect } from "react";
import { C } from "../constants/colors.js";
import { LLM_ENABLED } from "../config.js";
import { useStablePositions } from "../hooks/useStablePositions.js";
import { useWindowSize } from "../hooks/useWindowSize.js";
import {
  elementsAtRound,
  nextElementId,
  makeDiff,
  makeLogEntry,
} from "../utils/stateUtils.js";
import { Graph } from "./Graph.jsx";
import { TextTab } from "./TextTab.jsx";
import { HistoryTab } from "./HistoryTab.jsx";
import { Legend } from "./Legend.jsx";
import { EditModal } from "./EditModal.jsx";
import { EditRelationModal } from "./EditRelationModal.jsx";
import { NetworkIcon, HistoryIcon, MatrixIcon, ClusterIcon } from "./Icons.jsx";
import { ClusterTab } from "./ClusterTab.jsx";

// Loaded only in LLM-enabled builds; tree-shaken (with the openai SDK) in public builds.
const CoherenceMatrixTab = LLM_ENABLED
  ? lazy(() =>
      import("./CoherenceMatrixTab.jsx").then((m) => ({
        default: m.CoherenceMatrixTab,
      })),
    )
  : null;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a filtered view of `state` containing only elements and relations
 * that existed at the given round. Used to sync the TextTab with the history slider.
 *
 * @param {REStateType} state
 * @param {number}      round
 * @returns {REStateType}
 */
function stateAtRound(state, round) {
  const { active, withdrawn } = elementsAtRound(state.elements, round);
  const elements = [...active, ...withdrawn];
  const visIds = new Set(elements.map((e) => e.id));
  return {
    ...state,
    round,
    elements,
    relations: state.relations.filter(
      (r) =>
        visIds.has(r.from) && visIds.has(r.to) && (r.addedRound || 1) <= round,
    ),
  };
}

// ─── useREActions ─────────────────────────────────────────────────────────────

/**
 * Owns the mutable RE state and all mutation handlers.
 * Selection state is included here because several add/edit handlers
 * need to update it as a side-effect of saving.
 *
 * @param {REStateType} initialState
 */
function useREActions(initialState) {
  const [state, setState] = useState(initialState);
  const [editingEl, setEditingEl] = useState(null);
  const [editingRel, setEditingRel] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedRel, setSelectedRel] = useState(null);

  const handleSelectNode = (updater) => {
    setSelectedRel(null);
    setSelected(updater);
  };
  const handleSelectRel = (updater) => {
    setSelected(null);
    setSelectedRel(updater);
  };

  const handleEditRequest = (elementId) => {
    setSelected(elementId);
    setEditingEl(state.elements.find((e) => e.id === elementId) ?? null);
  };

  const handleEditSave = (formData) => {
    const newRound = state.round + 1;
    const oldEl = editingEl;
    const newEl = {
      ...oldEl,
      ...formData,
      status: "revised",
      previousText: oldEl.text,
      revisedRound: newRound,
    };
    delete newEl.withdrawnRound;
    delete newEl.reason;
    const diffs = makeDiff(
      ["type", "confidence", "status", "origin", "text"],
      oldEl,
      formData,
    );
    setState((prev) => ({
      ...prev,
      round: newRound,
      elements: prev.elements.map((e) => (e.id === oldEl.id ? newEl : e)),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `${oldEl.id} was edited by the user.`,
          "Changes applied",
          diffs.length ? diffs.join("; ") : "No fields changed",
        ),
      ],
    }));
    setEditingEl(null);
  };

  const handleRelEditSave = (formData) => {
    const newRound = state.round + 1;
    const diffs = makeDiff(["type", "explanation"], editingRel, formData);
    setState((prev) => ({
      ...prev,
      round: newRound,
      relations: prev.relations.map((r) =>
        r === editingRel
          ? {
              ...editingRel,
              ...formData,
              status: "revised",
              revisedRound: newRound,
            }
          : r,
      ),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `Relation ${editingRel.from} → ${editingRel.to} was edited by the user.`,
          "Changes applied",
          diffs.length ? diffs.join("; ") : "No fields changed",
        ),
      ],
    }));
    setEditingRel(null);
  };

  const handleWithdrawRequest = (elementId) => {
    const newRound = state.round + 1;
    setState((prev) => ({
      ...prev,
      round: newRound,
      elements: prev.elements.map((e) =>
        e.id === elementId
          ? {
              ...e,
              status: "withdrawn",
              withdrawnRound: newRound,
              reason: "",
              previousText: undefined,
              revisedRound: undefined,
            }
          : e,
      ),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `${elementId} was withdrawn by the user.`,
          "Withdrawn",
          `${elementId}: status → withdrawn`,
        ),
      ],
    }));
  };

  const handleWithdrawRelRequest = (rel) => {
    const newRound = state.round + 1;
    setState((prev) => ({
      ...prev,
      round: newRound,
      relations: prev.relations.map((r) =>
        r === rel ? { ...r, status: "withdrawn", withdrawnRound: newRound } : r,
      ),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `Relation ${rel.from} → ${rel.to} was withdrawn by the user.`,
          "Withdrawn",
          `${rel.from} → ${rel.to}: status → withdrawn`,
        ),
      ],
    }));
  };

  const handleAddElement = (formData) => {
    const newRound = state.round + 1;
    const newId = nextElementId(state.elements, formData.type);
    setState((prev) => ({
      ...prev,
      round: newRound,
      elements: [
        ...prev.elements,
        { id: newId, status: "active", addedRound: newRound, ...formData },
      ],
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `${newId} was added by the user.`,
          "Added",
          `${newId} added`,
        ),
      ],
    }));
    handleSelectNode(() => newId);
  };

  const handleAddRelation = (formData) => {
    const newRound = state.round + 1;
    const newRel = { ...formData, addedRound: newRound };
    setState((prev) => ({
      ...prev,
      round: newRound,
      relations: [...prev.relations, newRel],
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `Relation ${formData.from} → ${formData.to} was added by the user.`,
          "Added",
          `${formData.from} → ${formData.to} (${formData.type}) added`,
        ),
      ],
    }));
    handleSelectRel(() => newRel);
  };

  return {
    state,
    selected,
    selectedRel,
    handleSelectNode,
    handleSelectRel,
    editingEl,
    setEditingEl,
    handleEditRequest,
    handleEditSave,
    editingRel,
    setEditingRel,
    handleRelEditSave,
    handleWithdrawRequest,
    handleWithdrawRelRequest,
    handleAddElement,
    handleAddRelation,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TAB_ICONS = {
  graph: <NetworkIcon />,
  history: <HistoryIcon />,
  matrix: <MatrixIcon />,
  clusters: <ClusterIcon />,
};
const TAB_LABELS = {
  graph: "Graph",
  history: "History",
  matrix: "Matrix",
  clusters: "Clusters",
};

function AppHeader({
  round,
  topic,
  tab,
  setTab,
  showText,
  setShowText,
  onHome,
}) {
  const btn = (active) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 36,
    padding: "0 12px",
    boxSizing: "border-box",
    borderRadius: 4,
    border: `1px solid ${C.border}`,
    cursor: "pointer",
    fontSize: 12,
    background: active ? C.border : "transparent",
    color: active ? C.text : C.dim,
  });
  const tabs = [
    "graph",
    "history",
    "clusters",
    ...(LLM_ENABLED ? ["matrix"] : []),
  ];
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
      }}
    >
      <div>
        <div style={{ fontSize: 16, fontWeight: "bold" }}>
          Reflective Equilibrium — Round {round}
        </div>
        <div style={{ fontSize: 14, color: C.dim, marginTop: 2 }}>{topic}</div>
      </div>
      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={btn(tab === t)}>
            {TAB_ICONS[t]}
            {TAB_LABELS[t]}
          </button>
        ))}
        <button
          onClick={() => setShowText((s) => !s)}
          style={{ ...btn(false), position: "relative" }}
        >
          <span style={{ visibility: "hidden" }}>Hide text</span>
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {showText ? "Hide text" : "Show text"}
          </span>
        </button>
        <button onClick={onHome} style={{ ...btn(false), marginLeft: 50 }}>
          ← Home
        </button>
      </div>
    </div>
  );
}

function TextPanel({ isWide, clusterSectionRef, ...textTabProps }) {
  return (
    <div
      style={{
        width: isWide ? "50%" : "100%",
        height: isWide ? "auto" : 280,
        flexShrink: 0,
        borderRight: isWide ? `1px solid ${C.border}` : "none",
        borderBottom: isWide ? "none" : `1px solid ${C.border}`,
        paddingRight: isWide ? 12 : 0,
        paddingBottom: isWide ? 0 : 8,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <TextTab {...textTabProps} clusterSectionRef={clusterSectionRef} />
    </div>
  );
}

function GraphPanel({
  tab,
  state,
  positions,
  showWithdrawn,
  setShowWithdrawn,
  selected,
  onSelect,
  selectedRel,
  onSelectRel,
  onAddElement,
  onAddRelation,
  onRoundChange,
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Legend />
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: C.dim,
          cursor: "pointer",
        }}
      >
        <div
          onClick={() => setShowWithdrawn((s) => !s)}
          style={{
            width: 32,
            height: 18,
            borderRadius: 9,
            position: "relative",
            background: showWithdrawn ? "#7c3aed" : C.border,
            transition: "background 0.3s",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: C.text,
              position: "absolute",
              top: 2,
              left: showWithdrawn ? 16 : 2,
              transition: "left 0.3s ease",
            }}
          />
        </div>
        Show withdrawn
      </label>
      <div style={{ flex: 1, minHeight: 0, marginTop: 4 }}>
        {tab === "graph" && (
          <Graph
            state={state}
            showWithdrawn={showWithdrawn}
            positions={positions}
            selected={selected}
            onSelect={onSelect}
            selectedRel={selectedRel}
            onSelectRel={onSelectRel}
            onAddElement={onAddElement}
            onAddRelation={onAddRelation}
          />
        )}
        {tab === "history" && (
          <HistoryTab
            state={state}
            positions={positions}
            onRoundChange={onRoundChange}
          />
        )}
        {tab === "clusters" && (
          <ClusterTab
            state={state}
            positions={positions}
            showWithdrawn={showWithdrawn}
          />
        )}
        {tab === "matrix" && LLM_ENABLED && (
          <Suspense fallback={null}>
            <CoherenceMatrixTab state={state} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function EditModals({
  editingEl,
  setEditingEl,
  onEditSave,
  editingRel,
  setEditingRel,
  onRelEditSave,
  round,
}) {
  return (
    <>
      {editingEl && (
        <EditModal
          element={editingEl}
          currentRound={round}
          onSave={onEditSave}
          onCancel={() => setEditingEl(null)}
        />
      )}
      {editingRel && (
        <EditRelationModal
          relation={editingRel}
          currentRound={round}
          onSave={onRelEditSave}
          onCancel={() => setEditingRel(null)}
        />
      )}
    </>
  );
}

// ─── REState ──────────────────────────────────────────────────────────────────

/**
 * Root component of the RE visualisation app.
 *
 * Owns UI-level state (active tab, toggles, history round) and the shared force
 * simulation. All RE data mutations live in {@link useREActions}.
 *
 * @param {Object}      props
 * @param {REStateType} props.initialState
 * @param {Function}    props.onHome    - Called when the user navigates back to the home screen.
 * @param {Function}    props.onReady   - Called once the force simulation has settled.
 */
export default function REState({ initialState, onHome, onReady }) {
  const [tab, setTab] = useState("graph");
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [showText, setShowText] = useState(true);
  const [historyRound, setHistoryRound] = useState(0);

  const actions = useREActions(initialState);
  const {
    state,
    selected,
    selectedRel,
    handleSelectNode,
    handleSelectRel,
    editingEl,
    setEditingEl,
    handleEditSave,
    editingRel,
    setEditingRel,
    handleRelEditSave,
    handleEditRequest,
    handleWithdrawRequest,
    handleWithdrawRelRequest,
    handleAddElement,
    handleAddRelation,
  } = actions;

  const clusterSectionRef = useRef(null);
  const handleSetTab = (t) => {
    setTab(t);
    if (t === "clusters") {
      setShowText(true);
      requestAnimationFrame(() =>
        clusterSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
    }
  };

  const dims = useWindowSize();
  const isWide = dims.w > 768;
  const graphW = isWide && showText ? (dims.w - 32) / 2 - 12 : dims.w - 32;
  const { positions, ready } = useStablePositions(state, {
    w: graphW,
    h: dims.h,
  });
  useEffect(() => {
    if (ready) onReady?.();
  }, [ready, onReady]);

  const textState =
    tab === "history" ? stateAtRound(state, historyRound) : state;

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        fontFamily: "system-ui, sans-serif",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: 16,
        opacity: ready ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}
    >
      <AppHeader
        round={state.round}
        topic={state.topic}
        tab={tab}
        setTab={handleSetTab}
        showText={showText}
        setShowText={setShowText}
        onHome={onHome}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: isWide ? "row" : "column",
          gap: 12,
        }}
      >
        {showText && (
          <TextPanel
            isWide={isWide}
            clusterSectionRef={clusterSectionRef}
            state={textState}
            showWithdrawn={showWithdrawn}
            selected={selected}
            onSelect={handleSelectNode}
            selectedRel={selectedRel}
            onSelectRel={handleSelectRel}
            onEditRequest={handleEditRequest}
            onEditRelRequest={setEditingRel}
            onWithdrawRequest={handleWithdrawRequest}
            onWithdrawRelRequest={handleWithdrawRelRequest}
            onAddElement={handleAddElement}
            onAddRelation={handleAddRelation}
          />
        )}
        <GraphPanel
          tab={tab}
          state={state}
          positions={positions}
          showWithdrawn={showWithdrawn}
          setShowWithdrawn={setShowWithdrawn}
          selected={selected}
          onSelect={handleSelectNode}
          selectedRel={selectedRel}
          onSelectRel={handleSelectRel}
          onAddElement={handleAddElement}
          onAddRelation={handleAddRelation}
          onRoundChange={setHistoryRound}
        />
      </div>

      <EditModals
        editingEl={editingEl}
        setEditingEl={setEditingEl}
        onEditSave={handleEditSave}
        editingRel={editingRel}
        setEditingRel={setEditingRel}
        onRelEditSave={handleRelEditSave}
        round={state.round}
      />
    </div>
  );
}
