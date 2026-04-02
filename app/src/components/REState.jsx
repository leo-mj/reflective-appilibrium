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
        import("./RelationSuggestTab.jsx").then((m) => ({
          default: m.RelationSuggestTab,
        })),
      )
    : null;

const PrincipleSuggestTab =
  LLM_ENABLED | VITE_USE_DUMMY
    ? lazy(() =>
        import("./PrincipleSuggestTab.jsx").then((m) => ({
          default: m.PrincipleSuggestTab,
        })),
      )
    : null;

const JudgmentElicitTab =
  LLM_ENABLED | VITE_USE_DUMMY
    ? lazy(() =>
        import("./JudgmentElicitTab.jsx").then((m) => ({
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

  const handleAddRelation = (formData, { select = true } = {}) => {
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
    if (select) handleSelectRel(() => newRel);
  };

  const handleRejectElements = (formDatas) => {
    setState((prev) => {
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
    setState((prev) => ({
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

  const handleImportFile = async (file) => {
    try {
      const newState = await importStateFromFile(file);
      setState(newState);
      setSelected(null);
      setSelectedRel(null);
    } catch (e) {
      window.alert(`Import failed: ${e.message}`);
    }
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
    handleRejectElements,
    handleRejectRelations,
    handleImportFile,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TAB_ICONS = {
  graph: <NetworkIcon />,
  history: <HistoryIcon />,
  matrix: <MatrixIcon />,
  clusters: <ClusterIcon />,
  suggest: <SuggestIcon />,
  principles: <PrincipleIcon />,
  judgments: <JudgmentIcon />,
};
const TAB_LABELS = {
  graph: "Graph",
  history: "History",
  matrix: "Matrix",
  clusters: "Clusters",
  suggest: "Suggest Relations",
  principles: "Suggest Principles",
  judgments: "Elicit Judgments",
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
  onDownload,
  onImportFile,
  hasExistingState,
  onHome,
  isWide,
}) {
  const fileInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const handleImportClick = () => {
    if (
      hasExistingState &&
      !window.confirm("Importing will replace your current session. Continue?")
    )
      return;
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
  const ASSIST_TABS =
    LLM_ENABLED | VITE_USE_DUMMY ? ["suggest", "principles", "judgments"] : [];
  const metaTab = ASSIST_TABS.includes(tab) ? "assist" : "analyze";
  const visibleSubTabs = metaTab === "assist" ? ASSIST_TABS : ANALYZE_TABS;

  const hiddenInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".md"
      style={{ display: "none" }}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onImportFile(file);
        e.target.value = "";
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
          {divider}
          <div style={{ display: "flex", flex: "1 1 0", minWidth: 0 }}>
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
                if (metaTab !== "assist") setTab("suggest");
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
  setShowWithdrawn,
  showRejected,
  setShowRejected,
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
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          {
            label: "Show withdrawn",
            value: showWithdrawn,
            set: setShowWithdrawn,
            color: "#7c3aed",
          },
          {
            label: "Show rejected",
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
              gap: 6,
              fontSize: 11,
              color: C.dim,
              cursor: "pointer",
            }}
          >
            <div
              onClick={() => set((s) => !s)}
              style={{
                width: 32,
                height: 18,
                borderRadius: 9,
                position: "relative",
                background: value ? color : C.border,
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
                  left: value ? 16 : 2,
                  transition: "left 0.3s ease",
                }}
              />
            </div>
            {label}
          </label>
        ))}
      </div>
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
        {tab === "suggest" && LLM_ENABLED | VITE_USE_DUMMY && (
          <Suspense fallback={null}>
            <RelationSuggestTab
              state={state}
              onAddRelation={onAddRelation}
              onScrollToRelations={onScrollToRelations}
              onRejectRelations={onRejectRelations}
            />
          </Suspense>
        )}
        {tab === "principles" && LLM_ENABLED | VITE_USE_DUMMY && (
          <Suspense fallback={null}>
            <PrincipleSuggestTab
              state={state}
              onAddElement={onAddElement}
              onRejectElements={onRejectElements}
            />
          </Suspense>
        )}
        {tab === "judgments" && LLM_ENABLED | VITE_USE_DUMMY && (
          <Suspense fallback={null}>
            <JudgmentElicitTab
              state={state}
              onAddElement={onAddElement}
              onRejectElements={onRejectElements}
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
 * @param {() => void}  props.onHome    - Called when the user navigates back to the home screen.
 * @param {() => void}  props.onReady   - Called once the force simulation has settled.
 */
export default function REState({ initialState, onHome, onReady }) {
  const [tab, setTab] = useState("graph");
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
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
    handleRejectElements,
    handleRejectRelations,
    handleImportFile,
  } = actions;

  const clusterSectionRef = useRef(null);
  const [scrollToRelationsKey, setScrollToRelationsKey] = useState(0);
  const scrollToRelations = () => {
    if (isWide) setShowText(true);
    else setTab("text");
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
  const graphW = isWide && showText ? (dims.w - 32) / 2 - 12 : dims.w - 32;
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
        onDownload={() => downloadMarkdown(state, positions)}
        onImportFile={handleImportFile}
        hasExistingState={state.elements.length > 0}
        onHome={onHome}
        isWide={isWide}
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
        {(isWide ? showText : tab === "text") && (
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
            setShowWithdrawn={setShowWithdrawn}
            showRejected={showRejected}
            setShowRejected={setShowRejected}
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
          />
        )}
      </div>

      {isWide && (
        <AddBar
          elements={state.elements.filter(
            (e) => e.status !== "withdrawn" && e.status !== "rejected",
          )}
          onAddElement={handleAddElement}
          onAddRelation={handleAddRelation}
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
      />
    </div>
  );
}
