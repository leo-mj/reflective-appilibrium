import { useState, useRef, useEffect } from "react";
import { C } from "../constants/colors.js";
import { VITE_USE_DUMMY } from "../config.js";
import { useStablePositions } from "../hooks/useStablePositions.js";
import { useWindowSize } from "../hooks/useWindowSize.js";
import { stateAtRound } from "../utils/stateUtils.js";
import { useREActions } from "../hooks/useREActions.js";
import { ASSIST_TABS } from "../constants/tabConstants.jsx";
import { downloadMarkdown } from "../utils/exportMarkdown.js";
import { saveSession } from "../utils/sessionsClient.js";
import { WORKFLOW_NEXT_PHASE, nextPhaseEnabled } from "../utils/workflowUtils.js";
import { AppHeader } from "./AppHeader.jsx";
import { TextPanel } from "./TextPanel.jsx";
import { GraphPanel } from "./GraphPanel.jsx";
import { EditModals } from "./user_edits/EditModals.jsx";
import { AddBar } from "./user_edits/TextTabAddPanel.jsx";
export default function REState({ initialState, onHome, onReady }) {
  const [tab, setTab] = useState("graph");
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [showText, setShowText] = useState(true);
  const [assistSidePanel, setAssistSidePanel] = useState("text");
  const [historyRound, setHistoryRound] = useState(0);
  const [workflowPhase, setWorkflowPhase] = useState(null);
  const [addBarCtrlTo, setAddBarCtrlTo] = useState(null);
  const [workflowLoops, setWorkflowLoops] = useState(0);

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
  } = useREActions(initialState);

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

  const dims = useWindowSize();
  const isWide = dims.w > 768 && dims.h > 500;
  const isAssistTab = ASSIST_TABS.includes(tab);
  const hasSidePanel = isWide && (isAssistTab ? assistSidePanel !== "none" : showText);
  // graphW must match the actual rendered width of the graph SVG so the force
  // simulation centres nodes in the visible area.
  const graphW =
    isAssistTab && assistSidePanel === "graph"
      ? (dims.w - 44) / 2
      : hasSidePanel
        ? (dims.w - 32) / 2 - 12
        : dims.w - 32;
  const { positions, ready } = useStablePositions(state, {
    w: graphW,
    h: dims.h * 0.8,
  });
  useEffect(() => {
    if (ready) onReady?.();
  }, [ready, onReady]);

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
      if (isAssistTab) setAssistSidePanel("text");
      else setShowText(true);
    } else setTab("text");
    setScrollToRelationsKey((k) => k + 1);
  };

  const handleSetTab = (t) => {
    setTab(t);
    if (t === "clusters" && isWide) {
      setShowText(true);
      requestAnimationFrame(() =>
        clusterSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };

  const textState = tab === "history" ? stateAtRound(state, historyRound) : state;

  // Props shared by both the assist-side and analyze-mode TextPanel instances.
  const showingTextPanel = isWide
    ? isAssistTab ? assistSidePanel === "text" : showText
    : tab === "text";
  const textPanelProps = {
    isWide,
    clusterSectionRef,
    scrollToRelationsKey,
    state: textState,
    showWithdrawn,
    showRejected,
    selected,
    onSelect: handleSelectNode,
    selectedRel,
    onSelectRel: handleSelectRel,
    onEditRequest: handleEditRequest,
    onEditRelRequest: setEditingRel,
    onWithdrawRequest: handleWithdrawRequest,
    onWithdrawRelRequest: handleWithdrawRelRequest,
    onAddElement: isWide
      ? handleAddElement
      : (d) => { handleAddElement(d); handleSelectNode(() => null); },
    onAddRelation: isWide
      ? handleAddRelation
      : (d) => { handleAddRelation(d); handleSelectRel(() => null); },
  };

  const graphPanelCommonProps = {
    state,
    positions,
    showWithdrawn,
    showRejected,
    selected,
    onSelect: handleSelectNode,
    selectedRel,
    onSelectRel: handleSelectRel,
    onAddElement: handleAddElement,
    onAddRelation: handleAddRelation,
    onScrollToRelations: scrollToRelations,
    onRejectElements: handleRejectElements,
    onRejectRelations: handleRejectRelations,
    onRoundChange: setHistoryRound,
    isWide,
    onCtrlSecondSelect: setAddBarCtrlTo,
    ready,
  };

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
        onSave={() => saveSession(state)}
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
        {isWide && isAssistTab && assistSidePanel === "graph" && (
          <GraphPanel
            {...graphPanelCommonProps}
            tab="graph"
            workflowPhase={null}
            onAdvanceWorkflow={null}
            nextPhaseIsEnabled={false}
            onCtrlSecondSelect={setAddBarCtrlTo}
          />
        )}
        {showingTextPanel && <TextPanel {...textPanelProps} />}
        {(isWide || tab !== "text") && (
          <GraphPanel
            {...graphPanelCommonProps}
            tab={tab}
            workflowPhase={workflowPhase}
            onAdvanceWorkflow={advanceWorkflow}
            nextPhaseIsEnabled={workflowNextPhaseEnabled}
          />
        )}
      </div>

      {isWide && (!isAssistTab || assistSidePanel === "graph") && (
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
