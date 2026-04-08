/**
 * @fileoverview Root application component — state management and layout.
 * @module components/REState
 */

/** @import { REState as REStateType } from '../types.js' */ // aliased to avoid clash with the component name

import { useState, useRef, lazy, Suspense, useEffect } from "react";
import { C } from "../constants/colors.js";
import { LLM_ENABLED, VITE_USE_DUMMY } from "../config.js";
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
import { Legend } from "./graphs_shared/Legend.jsx";
import { EditModal } from "./user_edits/EditModal.jsx";
import { EditRelationModal } from "./user_edits/EditRelationModal.jsx";
import { WithdrawReasonModal } from "./user_edits/WithdrawReasonModal.jsx";
import { ModalShell } from "./user_edits/ModalShell.jsx";
import {
  NetworkIcon,
  HistoryIcon,
  MatrixIcon,
  ClusterIcon,
  SuggestIcon,
  PrincipleIcon,
  JudgmentIcon,
} from "./Icons.jsx";
import { ClusterTab } from "./ClusterTab.jsx";
import { AddBar } from "./user_edits/TextTabAddPanel.jsx";
import { downloadMarkdown } from "../utils/exportMarkdown.js";
import { importStateFromFile } from "../utils/importMarkdown.js";
import {
  WORKFLOW_PHASE_LABELS,
  WORKFLOW_NEXT_PHASE,
  nextPhaseEnabled,
} from "../utils/workflowUtils.js";

// Loaded only in LLM-enabled builds; tree-shaken in public builds.
const CoherenceMatrixTab =
  LLM_ENABLED | VITE_USE_DUMMY
    ? lazy(() =>
        import("./CoherenceMatrixTab.jsx").then((m) => ({
          default: m.CoherenceMatrixTab,
        })),
      )
    : null;

const RelationSuggestTab =
  LLM_ENABLED | VITE_USE_DUMMY
    ? lazy(() =>
        import("./workflows/RelationSuggestTab.jsx").then((m) => ({
          default: m.RelationSuggestTab,
        })),
      )
    : null;

const PrincipleSuggestTab =
  LLM_ENABLED | VITE_USE_DUMMY
    ? lazy(() =>
        import("./workflows/PrincipleSuggestTab.jsx").then((m) => ({
          default: m.PrincipleSuggestTab,
        })),
      )
    : null;

const JudgmentElicitTab =
  LLM_ENABLED | VITE_USE_DUMMY
    ? lazy(() =>
        import("./workflows/JudgmentElicitTab.jsx").then((m) => ({
          default: m.JudgmentElicitTab,
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
  const undoStack = useRef([]);
  const MAX_UNDO = 20;
  const [undoCount, setUndoCount] = useState(0);

  const mutate = (updater) => {
    setState((prev) => {
      undoStack.current = [prev, ...undoStack.current].slice(0, MAX_UNDO);
      return updater(prev);
    });
    setUndoCount((n) => n + 1);
  };

  const [editingEl, setEditingEl] = useState(null);
  const [editingRel, setEditingRel] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedRel, setSelectedRel] = useState(null);
  const [withdrawingId, setWithdrawingId] = useState(null);

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
    // Destructure to explicitly exclude withdrawn-only fields from the revised element.
    // eslint-disable-next-line no-unused-vars
    const { withdrawnRound, reason, ...oldElBase } = oldEl;
    const newEl = {
      ...oldElBase,
      ...formData,
      status: "revised",
      previousText: oldEl.text,
      revisedRound: newRound,
    };
    const diffs = makeDiff(
      ["type", "confidence", "status", "origin", "text"],
      oldEl,
      formData,
    );
    mutate((prev) => ({
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
    mutate((prev) => ({
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
    setWithdrawingId(elementId);
  };

  const handleWithdrawConfirm = (elementId, reason) => {
    const newRound = state.round + 1;
    mutate((prev) => ({
      ...prev,
      round: newRound,
      elements: prev.elements.map((e) =>
        e.id === elementId
          ? {
              ...e,
              status: "withdrawn",
              withdrawnRound: newRound,
              reason: reason ?? "",
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
    setWithdrawingId(null);
    if (selected === elementId) setSelected(null);
  };

  const handleWithdrawRelRequest = (rel) => {
    const newRound = state.round + 1;
    mutate((prev) => ({
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
    if (selectedRel === rel) setSelectedRel(null);
  };

  const handleAddElement = (formData) => {
    const newRound = state.round + 1;
    const newId = nextElementId(state.elements, formData.type);
    mutate((prev) => ({
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

  const handleAddRelation = (formData, { select = true } = {}) => {
    const newRound = state.round + 1;
    const newRel = { ...formData, addedRound: newRound };
    mutate((prev) => ({
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
    if (select) handleSelectRel(() => newRel);
  };

  const handleRejectElements = (formDatas) => {
    mutate((prev) => {
      // Assign IDs sequentially, feeding each new element into the next ID lookup.
      let running = prev.elements;
      const newEls = formDatas.map((fd) => {
        const id = nextElementId(running, fd.type);
        const el = {
          id,
          status: "rejected",
          addedRound: prev.round,
          rejectedRound: prev.round,
          ...fd,
        };
        running = [...running, el];
        return el;
      });
      return {
        ...prev,
        elements: [...prev.elements, ...newEls],
        log: [
          ...prev.log,
          makeLogEntry(
            prev.round,
            `${formDatas.length} suggestion${formDatas.length !== 1 ? "s" : ""} rejected.`,
            "Rejected",
            formDatas.map((fd) => fd.text).join("; "),
          ),
        ],
      };
    });
  };

  const handleRejectRelations = (formDatas) => {
    mutate((prev) => ({
      ...prev,
      relations: [
        ...prev.relations,
        ...formDatas.map((fd) => ({
          ...fd,
          status: "rejected",
          addedRound: prev.round,
          rejectedRound: prev.round,
        })),
      ],
      log: [
        ...prev.log,
        makeLogEntry(
          prev.round,
          `${formDatas.length} relation suggestion${formDatas.length !== 1 ? "s" : ""} rejected.`,
          "Rejected",
          formDatas
            .map((fd) => `${fd.from} → ${fd.to} (${fd.type})`)
            .join("; "),
        ),
      ],
    }));
  };

  const handleUndo = () => {
    const prev = undoStack.current[0];
    if (!prev) return;
    undoStack.current = undoStack.current.slice(1);
    setUndoCount((n) => n - 1);
    setState(prev);
    if (selected && !prev.elements.some((e) => e.id === selected)) {
      setSelected(null);
    }
    if (selectedRel && !prev.relations.some((r) => r === selectedRel)) {
      setSelectedRel(null);
    }
  };
  const canUndo = undoCount > 0;

  const handleImportFile = async (file) => {
    const newState = await importStateFromFile(file);
    undoStack.current = [];
    setUndoCount(0);
    setState(newState);
    setSelected(null);
    setSelectedRel(null);
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
    handleWithdrawConfirm,
    withdrawingId,
    setWithdrawingId,
    handleWithdrawRelRequest,
    handleAddElement,
    handleAddRelation,
    handleRejectElements,
    handleRejectRelations,
    handleImportFile,
    handleUndo,
    canUndo,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ASSIST_TABS =
  LLM_ENABLED | VITE_USE_DUMMY
    ? ["elicitJudgments", "suggestPrinciples", "suggestRelations"]
    : [];

const TAB_ICONS = {
  graph: <NetworkIcon />,
  history: <HistoryIcon />,
  matrix: <MatrixIcon />,
  clusters: <ClusterIcon />,
  suggestRelations: <SuggestIcon />,
  suggestPrinciples: <PrincipleIcon />,
  elicitJudgments: <JudgmentIcon />,
};
const TAB_LABELS = {
  graph: "Graph",
  history: "History",
  matrix: "Matrix",
  clusters: "Clusters",
  elicitJudgments: "Elicit Judgments",
  suggestPrinciples: "Suggest Principles",
  suggestRelations: "Suggest Relations",
};

/**
 * Topic text with hover tooltip (desktop) and tap tooltip (mobile).
 *
 * @param {Object} props
 * @param {string} props.topic
 * @param {import('react').CSSProperties} [props.style]
 */
function TopicLabel({ topic, style }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{ position: "relative", minWidth: 0, ...style }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onPointerUp={(e) => {
        if (e.pointerType === "touch") setOpen((s) => !s);
      }}
    >
      <div
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {topic}
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            zIndex: 200,
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
            color: C.text,
            whiteSpace: "normal",
            maxWidth: 320,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            pointerEvents: "none",
          }}
        >
          {topic}
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object}   props
 * @param {number}   props.round
 * @param {string}   props.topic
 * @param {string}   props.tab
 * @param {function(string): void} props.setTab
 * @param {boolean}  props.showText
 * @param {import('react').Dispatch<import('react').SetStateAction<boolean>>} props.setShowText
 * @param {boolean}  props.showWithdrawn
 * @param {import('react').Dispatch<import('react').SetStateAction<boolean>>} props.setShowWithdrawn
 * @param {boolean}  props.showRejected
 * @param {import('react').Dispatch<import('react').SetStateAction<boolean>>} props.setShowRejected
 * @param {function(): void} props.onDownload
 * @param {function(File): void} props.onImportFile
 * @param {boolean}  props.hasExistingState
 * @param {function(): void} props.onHome
 * @param {boolean}  props.isWide
 */
function AppHeader({
  round,
  topic,
  tab,
  setTab,
  showText,
  setShowText,
  showWithdrawn,
  setShowWithdrawn,
  showRejected,
  setShowRejected,
  assistSidePanel,
  setAssistSidePanel,
  onDownload,
  onImportFile,
  hasExistingState,
  onHome,
  isWide,
  workflowPhase,
  workflowLoops,
  onStartWorkflow,
  onStopWorkflow,
  onUndo,
  canUndo,
}) {
  const fileInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importConfirmPending, setImportConfirmPending] = useState(null);
  const [importError, setImportError] = useState(null);

  const doImport = async (file) => {
    try {
      await onImportFile(file);
    } catch (e) {
      setImportError(e.message);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current.click();
  };
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
    fontFamily: "inherit",
  });
  // Classic connected-tab style for the Analyze / Assist meta-tab buttons.
  // The active tab's bottom border matches the page background, making it
  // appear to open into the content below the tab bar border.
  const metaTabBtn = (active) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 30,
    padding: "0 14px",
    boxSizing: "border-box",
    borderRadius: "4px 4px 0 0",
    border: `1px solid ${C.border}`,
    borderBottom: `1px solid ${active ? C.bg : C.border}`,
    marginBottom: active ? -1 : 0,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? "600" : "normal",
    background: active ? C.border : "transparent",
    color: active ? C.text : C.dim,
    fontFamily: "inherit",
    position: "relative",
    zIndex: active ? 1 : 0,
  });
  const ANALYZE_TABS = [
    "graph",
    "history",
    "clusters",
    ...(LLM_ENABLED | VITE_USE_DUMMY ? ["matrix"] : []),
  ];
  const metaTab = ASSIST_TABS.includes(tab) ? "assist" : "analyze";
  const visibleSubTabs = metaTab === "assist" ? ASSIST_TABS : ANALYZE_TABS;

  const importModals = (
    <>
      {importConfirmPending && (
        <ModalShell
          title="Replace session?"
          subtitle="Importing will replace your current session."
          onCancel={() => setImportConfirmPending(null)}
          onSave={() => {
            const file = importConfirmPending;
            setImportConfirmPending(null);
            doImport(file);
          }}
          saveLabel="Replace"
          saveDisabled={false}
        />
      )}
      {importError && (
        <ModalShell
          title="Import failed"
          subtitle={importError}
          onCancel={() => setImportError(null)}
          onSave={() => setImportError(null)}
          saveLabel="OK"
        />
      )}
    </>
  );

  const hiddenInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".md"
      style={{ display: "none" }}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (hasExistingState) {
          setImportConfirmPending(file);
        } else {
          doImport(file);
        }
      }}
    />
  );
  // ── Narrow (phone): title + hamburger menu ─────────────────────────────────
  if (!isWide) {
    const menuBtn = (active = false) => ({
      ...btn(active),
      width: "100%",
      justifyContent: "flex-start",
      gap: 8,
    });
    const divider = (
      <div style={{ height: 1, background: C.border, margin: "2px 0" }} />
    );
    const close = (fn) => () => {
      fn();
      setMenuOpen(false);
    };

    return (
      <div style={{ position: "relative", marginBottom: 6 }}>
        {hiddenInput}
        {importModals}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: "bold",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Round {round}
            </div>
            <TopicLabel topic={topic} style={{ fontSize: 12, color: C.dim }} />
          </div>
          <button
            onClick={() => setMenuOpen((m) => !m)}
            style={{
              ...btn(menuOpen),
              flexShrink: 0,
              marginLeft: 8,
              border: `1px solid ${C.text}`,
            }}
          >
            ☰
          </button>
        </div>
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              zIndex: 100,
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              width: "100%",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            <button onClick={close(onHome)} style={menuBtn()}>
              ← Home
            </button>
            {divider}
            <div
              style={{
                fontSize: 10,
                color: C.dim,
                fontWeight: "bold",
                padding: "4px 4px 2px",
                letterSpacing: "0.05em",
              }}
            >
              Analyze
            </div>
            {ANALYZE_TABS.map((t) => (
              <button
                key={t}
                onClick={close(() => setTab(t))}
                style={menuBtn(tab === t)}
              >
                {TAB_ICONS[t]}
                {TAB_LABELS[t]}
              </button>
            ))}
            {LLM_ENABLED | VITE_USE_DUMMY && (
              <>
                <div
                  style={{
                    fontSize: 10,
                    color: C.dim,
                    fontWeight: "bold",
                    padding: "4px 4px 2px",
                    letterSpacing: "0.05em",
                  }}
                >
                  Assist
                </div>
                {ASSIST_TABS.map((t) => (
                  <button
                    key={t}
                    onClick={close(() => setTab(t))}
                    style={menuBtn(tab === t)}
                  >
                    {TAB_ICONS[t]}
                    {TAB_LABELS[t]}
                  </button>
                ))}
                {workflowPhase ? (
                  <>
                    <button
                      onClick={close(onStopWorkflow)}
                      style={{
                        ...menuBtn(),
                        color: C.conflicts,
                        borderColor: C.conflicts,
                      }}
                    >
                      ✕ Stop Workflow
                      <span
                        style={{ marginLeft: 6, fontSize: 10, color: C.dim }}
                      >
                        ({WORKFLOW_PHASE_LABELS[workflowPhase]}
                        {workflowLoops > 0
                          ? ` · Loop ${workflowLoops + 1}`
                          : ""}
                        )
                      </span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={close(onStartWorkflow)}
                    style={{ ...menuBtn(), color: C.supports }}
                  >
                    ▶ Start Workflow
                  </button>
                )}
              </>
            )}
            <button
              onClick={close(() => setTab("text"))}
              style={menuBtn(tab === "text")}
            >
              Text
            </button>
            {divider}
            <button
              onClick={close(onUndo)}
              disabled={!canUndo}
              style={{ ...menuBtn(), opacity: canUndo ? 1 : 0.4 }}
            >
              ↩ Undo
            </button>
            <button
              onClick={() => {
                handleImportClick();
                setMenuOpen(false);
              }}
              style={menuBtn()}
            >
              ↑ Import
            </button>
            <button
              onClick={close(onDownload)}
              style={{
                ...menuBtn(),
                background: C.theory.high,
                color: C.text,
                border: "none",
              }}
            >
              ↓ Export
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Wide (desktop): two-row layout ───────────────────────────────────────
  const divider = (
    <div
      style={{
        width: 1,
        height: 20,
        background: C.border,
        alignSelf: "center",
        margin: "0 4px",
      }}
    />
  );
  return (
    <div>
      {hiddenInput}
      {importModals}
      {/* Row 1: utility — import/export, title, show-text, home */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: "bold",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Reflective Equilibrium — Round {round}
          </div>
          <TopicLabel
            topic={topic}
            style={{ fontSize: 14, color: C.dim, marginTop: 2 }}
          />
        </div>
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          {metaTab === "assist" ? (
            <div style={{ display: "flex", gap: 0, flexShrink: 0 }}>
              {[
                { value: "text", label: "Text" },
                { value: "graph", label: "Graph" },
              ].map(({ value, label }, i) => (
                <button
                  key={value}
                  onClick={() => setAssistSidePanel(value)}
                  style={{
                    ...btn(assistSidePanel === value),
                    borderRadius:
                      i === 0 ? "4px 0 0 4px" : i === 1 ? "0 4px 4px 0" : 0,
                    // borderRight: i < 2 ? "none" : undefined,
                    fontSize: 11,
                    padding: "0 10px",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setShowText((s) => !s)}
              style={{ ...btn(false), position: "relative" }}
            >
              <span style={{ visibility: "hidden" }}>
                {showText ? "Hide text" : "Show text"}
              </span>
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
          )}
          {[
            {
              label: "Withdrawn",
              value: showWithdrawn,
              set: setShowWithdrawn,
              color: "#7c3aed",
            },
            {
              label: "Rejected",
              value: showRejected,
              set: setShowRejected,
              color: "#fb7185",
            },
          ].map(({ label, value, set, color }) => (
            <label
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: C.dim,
                cursor: "pointer",
                marginLeft: 6,
              }}
            >
              <div
                onClick={() => set((s) => !s)}
                style={{
                  width: 28,
                  height: 16,
                  borderRadius: 8,
                  position: "relative",
                  background: value ? color : C.border,
                  transition: "background 0.3s",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    background: C.text,
                    position: "absolute",
                    top: 2,
                    left: value ? 14 : 2,
                    transition: "left 0.3s ease",
                  }}
                />
              </div>
              {label}
            </label>
          ))}
          {divider}
          <div style={{ display: "flex", flex: "1 1 0", minWidth: 0 }}>
            <button
              onClick={onUndo}
              disabled={!canUndo}
              style={{ marginRight: 2, flexShrink: 0, ...btn(false), opacity: canUndo ? 1 : 0.4 }}
            >
              ↩ Undo
            </button>
            <button
              onClick={handleImportClick}
              style={{ marginRight: 2, flexShrink: 0, ...btn(false) }}
            >
              ↑ Import
            </button>
            <button
              onClick={onDownload}
              style={{
                flexShrink: 0,
                ...btn(true),
                background: C.theory.high,
              }}
            >
              ↓ Export
            </button>
            {divider}
            <button onClick={onHome} style={{ ...btn(false) }}>
              ← Home
            </button>
          </div>
        </div>
      </div>
      {/* Row 2: tab bar — meta-tabs connect to the border below */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 2,
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 6,
          paddingBottom: 2,
        }}
      >
        {LLM_ENABLED | VITE_USE_DUMMY && (
          <>
            <button
              style={metaTabBtn(metaTab === "analyze")}
              onClick={() => {
                if (metaTab !== "analyze") setTab("graph");
              }}
            >
              Analyze
            </button>
            <button
              style={metaTabBtn(metaTab === "assist")}
              onClick={() => {
                if (metaTab !== "assist") setTab("elicitJudgments");
              }}
            >
              Assist
            </button>
            <div
              style={{
                width: 1,
                height: 20,
                background: C.border,
                alignSelf: "center",
                margin: "0 4px",
              }}
            />
          </>
        )}
        {visibleSubTabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={btn(tab === t)}>
            {TAB_ICONS[t]}
            {TAB_LABELS[t]}
          </button>
        ))}
        {metaTab === "assist" && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {workflowPhase && (
              <span style={{ fontSize: 11, color: C.dim }}>
                {WORKFLOW_PHASE_LABELS[workflowPhase]}
                {workflowLoops > 0 ? ` · Loop ${workflowLoops + 1}` : ""}
              </span>
            )}
            {workflowPhase ? (
              <>
                <button
                  onClick={onStopWorkflow}
                  style={{
                    ...btn(false),
                    color: C.conflicts,
                    borderColor: C.conflicts,
                  }}
                >
                  ✕ Stop Workflow
                </button>
              </>
            ) : (
              <button
                onClick={onStartWorkflow}
                style={{ ...btn(false), color: C.supports }}
              >
                ▶ Start Workflow
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TextPanel({
  isWide,
  clusterSectionRef,
  scrollToRelationsKey,
  ...textTabProps
}) {
  return (
    <div
      style={{
        width: isWide ? "50%" : "100%",
        flex: isWide ? undefined : 1,
        height: isWide ? "auto" : undefined,
        flexShrink: isWide ? 0 : undefined,
        borderRight: isWide ? `1px solid ${C.border}` : "none",
        borderBottom: isWide ? "none" : `1px solid ${C.border}`,
        paddingRight: isWide ? 12 : 0,
        paddingBottom: isWide ? 0 : 8,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <TextTab
        {...textTabProps}
        clusterSectionRef={clusterSectionRef}
        scrollToRelationsKey={scrollToRelationsKey}
        isWide={isWide}
      />
    </div>
  );
}

function GraphPanel({
  tab,
  state,
  positions,
  showWithdrawn,
  showRejected,
  selected,
  onSelect,
  selectedRel,
  onSelectRel,
  onAddElement,
  onAddRelation,
  onScrollToRelations,
  onRejectElements,
  onRejectRelations,
  onRoundChange,
  isWide,
  workflowPhase,
  onAdvanceWorkflow,
  nextPhaseIsEnabled,
  onCtrlSecondSelect,
  ready,
}) {
  const autoFetch = !!workflowPhase;
  const isAssistPanel = ASSIST_TABS.includes(tab);
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
      {!isAssistPanel && <Legend />}
      <div style={{ flex: 1, minHeight: 0, marginTop: 4 }}>
        {tab === "graph" && (
          <Graph
            state={state}
            showWithdrawn={showWithdrawn}
            showRejected={showRejected}
            positions={positions}
            selected={selected}
            onSelect={onSelect}
            selectedRel={selectedRel}
            onSelectRel={onSelectRel}
            onAddElement={onAddElement}
            onAddRelation={onAddRelation}
            onCtrlSecondSelect={onCtrlSecondSelect}
            ready={ready}
          />
        )}
        {tab === "history" && (
          <HistoryTab
            state={state}
            positions={positions}
            onRoundChange={onRoundChange}
            isWide={isWide}
          />
        )}
        {tab === "clusters" && (
          <ClusterTab
            state={state}
            positions={positions}
            showWithdrawn={showWithdrawn}
          />
        )}
        {tab === "matrix" && LLM_ENABLED | VITE_USE_DUMMY && (
          <Suspense fallback={null}>
            <CoherenceMatrixTab state={state} />
          </Suspense>
        )}
        {tab === "suggestRelations" && LLM_ENABLED | VITE_USE_DUMMY && (
          <Suspense fallback={null}>
            <RelationSuggestTab
              state={state}
              onAddRelation={onAddRelation}
              onScrollToRelations={onScrollToRelations}
              onRejectRelations={onRejectRelations}
              autoFetch={autoFetch}
              workflowPhase={workflowPhase}
              onAdvanceWorkflow={onAdvanceWorkflow}
              nextPhaseIsEnabled={nextPhaseIsEnabled}
            />
          </Suspense>
        )}
        {tab === "suggestPrinciples" && LLM_ENABLED | VITE_USE_DUMMY && (
          <Suspense fallback={null}>
            <PrincipleSuggestTab
              state={state}
              onAddElement={onAddElement}
              onRejectElements={onRejectElements}
              autoFetch={autoFetch}
              workflowPhase={workflowPhase}
              onAdvanceWorkflow={onAdvanceWorkflow}
              nextPhaseIsEnabled={nextPhaseIsEnabled}
            />
          </Suspense>
        )}
        {tab === "elicitJudgments" && LLM_ENABLED | VITE_USE_DUMMY && (
          <Suspense fallback={null}>
            <JudgmentElicitTab
              state={state}
              onAddElement={onAddElement}
              onRejectElements={onRejectElements}
              autoFetch={autoFetch}
              workflowPhase={workflowPhase}
              onAdvanceWorkflow={onAdvanceWorkflow}
              nextPhaseIsEnabled={nextPhaseIsEnabled}
            />
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
  withdrawingId,
  onWithdrawConfirm,
  onWithdrawCancel,
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
      {withdrawingId && (
        <WithdrawReasonModal
          elementId={withdrawingId}
          onConfirm={(reason) => onWithdrawConfirm(withdrawingId, reason)}
          onCancel={onWithdrawCancel}
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
 * @param {() => void}  props.onHome    - Called when the user navigates back to the home screen.
 * @param {() => void}  props.onReady   - Called once the force simulation has settled.
 */
export default function REState({ initialState, onHome, onReady }) {
  const [tab, setTab] = useState("graph");
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [showText, setShowText] = useState(true);
  const [assistSidePanel, setAssistSidePanel] = useState("text");
  const [historyRound, setHistoryRound] = useState(0);
  const [workflowPhase, setWorkflowPhase] = useState(null);

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
    handleWithdrawConfirm,
    withdrawingId,
    setWithdrawingId,
    handleWithdrawRelRequest,
    handleAddElement,
    handleAddRelation,
    handleRejectElements,
    handleRejectRelations,
    handleImportFile,
    handleUndo,
    canUndo,
  } = actions;

  const [addBarCtrlTo, setAddBarCtrlTo] = useState(null);
  const [workflowLoops, setWorkflowLoops] = useState(0);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (
        e.key === "z" &&
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.target.tagName !== "TEXTAREA" &&
        e.target.tagName !== "INPUT"
      ) {
        e.preventDefault();
        handleUndo();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleUndo]);
  const startWorkflow = () => {
    setWorkflowPhase("elicitJudgments");
    setWorkflowLoops(0);
    setTab("elicitJudgments");
  };
  const stopWorkflow = () => {
    setWorkflowPhase(null);
    setWorkflowLoops(0);
  };
  const advanceWorkflow = () => {
    const next = WORKFLOW_NEXT_PHASE[workflowPhase];
    if (next === "elicitJudgments") setWorkflowLoops((n) => n + 1);
    setWorkflowPhase(next);
    setTab(next);
  };
  const workflowNextPhaseEnabled = nextPhaseEnabled(workflowPhase, state);

  const clusterSectionRef = useRef(null);
  const [scrollToRelationsKey, setScrollToRelationsKey] = useState(0);
  const scrollToRelations = () => {
    if (isWide) {
      if (ASSIST_TABS.includes(tab)) setAssistSidePanel("text");
      else setShowText(true);
    } else setTab("text");
    setScrollToRelationsKey((k) => k + 1);
  };

  const handleSetTab = (t) => {
    setTab(t);
    if (t === "clusters" && isWide) {
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
  const isWide = dims.w > 768 && dims.h > 500;
  const isAssistTab = ASSIST_TABS.includes(tab);
  const hasSidePanel =
    isWide && (isAssistTab ? assistSidePanel !== "none" : showText);
  // graphW must match the actual rendered width of the graph SVG panel so the
  // force simulation centres nodes in the visible area.
  // - Assist+graph: two flex:1 panels sharing (content - gap) → (W-32-12)/2
  // - Text+graph (analyze or assist+text): TextPanel=50%, GraphPanel=flex:1 → (W-32)/2-12
  // - Full width (no side panel): W-32
  const graphW =
    isAssistTab && assistSidePanel === "graph"
      ? (dims.w - 44) / 2
      : hasSidePanel
        ? (dims.w - 32) / 2 - 12
        : dims.w - 32;
  const { positions, ready } = useStablePositions(state, {
    w: graphW,
    h: dims.h * 0.8, // subtract the 20vh AddBar at the bottom
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
      {VITE_USE_DUMMY && (
        <div
          style={{
            background: C.panel,
            borderBottom: `1px solid ${C.border}`,
            color: C.dim,
            fontSize: 11,
            textAlign: "center",
            padding: "6px 16px",
            margin: "-16px -16px 12px -16px",
          }}
        >
          INFO: No LLM API connection — pre-set examples shown in the Analyze
          Tabs and the Matrix Tab
        </div>
      )}
      <AppHeader
        round={state.round}
        topic={state.topic}
        tab={tab}
        setTab={handleSetTab}
        showText={showText}
        setShowText={setShowText}
        showWithdrawn={showWithdrawn}
        setShowWithdrawn={setShowWithdrawn}
        showRejected={showRejected}
        setShowRejected={setShowRejected}
        assistSidePanel={assistSidePanel}
        setAssistSidePanel={setAssistSidePanel}
        onDownload={() => downloadMarkdown(state, positions)}
        onImportFile={handleImportFile}
        hasExistingState={state.elements.length > 0}
        onHome={onHome}
        isWide={isWide}
        workflowPhase={workflowPhase}
        workflowLoops={workflowLoops}
        onStartWorkflow={startWorkflow}
        onStopWorkflow={stopWorkflow}
        onUndo={handleUndo}
        canUndo={canUndo}
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
        {/* Left side panel */}
        {isWide && isAssistTab && assistSidePanel === "text" && (
          <TextPanel
            isWide={isWide}
            clusterSectionRef={clusterSectionRef}
            scrollToRelationsKey={scrollToRelationsKey}
            state={textState}
            showWithdrawn={showWithdrawn}
            showRejected={showRejected}
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
        {isWide && isAssistTab && assistSidePanel === "graph" && (
          <GraphPanel
            tab="graph"
            state={state}
            positions={positions}
            showWithdrawn={showWithdrawn}
            showRejected={showRejected}
            selected={selected}
            onSelect={handleSelectNode}
            selectedRel={selectedRel}
            onSelectRel={handleSelectRel}
            onAddElement={handleAddElement}
            onAddRelation={handleAddRelation}
            onScrollToRelations={scrollToRelations}
            onRejectElements={handleRejectElements}
            onRejectRelations={handleRejectRelations}
            onRoundChange={setHistoryRound}
            isWide={isWide}
            workflowPhase={null}
            onAdvanceWorkflow={null}
            nextPhaseIsEnabled={false}
            onCtrlSecondSelect={setAddBarCtrlTo}
            ready={ready}
          />
        )}
        {(!isWide ? tab === "text" : !isAssistTab && showText) && (
          <TextPanel
            isWide={isWide}
            clusterSectionRef={clusterSectionRef}
            scrollToRelationsKey={scrollToRelationsKey}
            state={textState}
            showWithdrawn={showWithdrawn}
            showRejected={showRejected}
            selected={selected}
            onSelect={handleSelectNode}
            selectedRel={selectedRel}
            onSelectRel={handleSelectRel}
            onEditRequest={handleEditRequest}
            onEditRelRequest={setEditingRel}
            onWithdrawRequest={handleWithdrawRequest}
            onWithdrawRelRequest={handleWithdrawRelRequest}
            onAddElement={
              isWide
                ? handleAddElement
                : /** @param {import('./user_edits/AddElementModal.jsx').AddElementFormData} d */ (
                    d,
                  ) => {
                    handleAddElement(d);
                    handleSelectNode(() => null);
                  }
            }
            onAddRelation={
              isWide
                ? handleAddRelation
                : /** @param {import('./user_edits/AddRelationModal.jsx').AddRelationFormData} d */ (
                    d,
                  ) => {
                    handleAddRelation(d);
                    handleSelectRel(() => null);
                  }
            }
          />
        )}
        {(isWide || tab !== "text") && (
          <GraphPanel
            tab={tab}
            state={state}
            positions={positions}
            showWithdrawn={showWithdrawn}
            showRejected={showRejected}
            selected={selected}
            onSelect={handleSelectNode}
            selectedRel={selectedRel}
            onSelectRel={handleSelectRel}
            onAddElement={handleAddElement}
            onAddRelation={handleAddRelation}
            onScrollToRelations={scrollToRelations}
            onRejectElements={handleRejectElements}
            onRejectRelations={handleRejectRelations}
            onRoundChange={setHistoryRound}
            isWide={isWide}
            workflowPhase={workflowPhase}
            onAdvanceWorkflow={advanceWorkflow}
            nextPhaseIsEnabled={workflowNextPhaseEnabled}
            onCtrlSecondSelect={setAddBarCtrlTo}
            ready={ready}
          />
        )}
      </div>

      {isWide && !isAssistTab && (
        <AddBar
          elements={state.elements.filter(
            (e) => e.status !== "withdrawn" && e.status !== "rejected",
          )}
          onAddElement={handleAddElement}
          onAddRelation={handleAddRelation}
          selected={selected}
          ctrlTo={addBarCtrlTo}
        />
      )}

      <EditModals
        editingEl={editingEl}
        setEditingEl={setEditingEl}
        onEditSave={handleEditSave}
        editingRel={editingRel}
        setEditingRel={setEditingRel}
        onRelEditSave={handleRelEditSave}
        round={state.round}
        withdrawingId={withdrawingId}
        onWithdrawConfirm={handleWithdrawConfirm}
        onWithdrawCancel={() => setWithdrawingId(null)}
      />
    </div>
  );
}
