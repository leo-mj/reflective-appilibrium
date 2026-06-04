import { useState, useRef, useEffect } from "react";
import { C } from "../constants/colors.js";
import { LLM_ENABLED } from "../config.js";
import { useStablePositions } from "../hooks/useStablePositions.js";
import { useWindowSize } from "../hooks/useWindowSize.js";
import { stateAtRound } from "../utils/stateUtils.js";
import { useREActions } from "../hooks/useREActions.js";
import { ASSIST_TABS } from "../constants/tabConstants.jsx";
import { downloadMarkdown } from "../utils/exportMarkdown.js";
import { saveSession } from "../utils/sessionsClient.js";
import {
  WORKFLOW_NEXT_PHASE,
  nextPhaseEnabled,
} from "../utils/workflowUtils.js";
import { AppHeader } from "./AppHeader.jsx";
import { TextPanel } from "./TextPanel.jsx";
import { GraphPanel } from "./GraphPanel.jsx";
import { EditModals } from "./user_edits/EditModals.jsx";
import { AddBar } from "./user_edits/TextTabAddPanel.jsx";
export default function REState({ initialState, isSample, onHome, onReady }) {
  const [tab, setTab] = useState(
    initialState.model === "questionnaire" ? "questionnaire" : "elicitJudgments",
  );
  const [hiddenLegendKeys, setHiddenLegendKeys] = useState(new Set());
  const [showText, setShowText] = useState(true);
  const [showTabNav, setShowTabNav] = useState(false);
  const [expandAllKey, setExpandAllKey] = useState(0);
  const [allExpanded, setAllExpanded] = useState(false);
  const [assistSidePanel, setAssistSidePanel] = useState("text");
  const [historyRound, setHistoryRound] = useState(0);
  const [workflowPhase, setWorkflowPhase] = useState(null);
  const [addBarCtrlTo, setAddBarCtrlTo] = useState(null);
  const [workflowLoops, setWorkflowLoops] = useState(0);
  const [hideNonEntailsRels, setHideNonEntailsRels] = useState(true);
  const [equilibriumPreviewWithdrawnIds, setEquilibriumPreviewWithdrawnIds] =
    useState(null);
  const DEFAULT_WEIGHTS = { account: 0.35, systematicity: 0.55, faithfulness: 0.1 };
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const weightsChanged =
    weights.account !== DEFAULT_WEIGHTS.account ||
    weights.systematicity !== DEFAULT_WEIGHTS.systematicity ||
    weights.faithfulness !== DEFAULT_WEIGHTS.faithfulness;
  // Pass null when weights are default so backend uses its own defaults.
  const effectiveWeights = weightsChanged ? weights : null;

  const {
    state,
    selected,
    selectedRel,
    recentlyAdded,
    recentlyAddedRel,
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
    handleDeleteRelationsByArgId,
    handleAddElement,
    handleAddRelation,
    handleQuestionnaireSelectAnswer,
    handleRejectElements,
    handleRejectRelations,
    handleApplyRethonEquilibrium,
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
  const hasSidePanel =
    isWide &&
    (isAssistTab
      ? assistSidePanel !== "none" && assistSidePanel !== "focus"
      : showText);
  // graphW must match the actual rendered width of the graph SVG so the force
  // simulation centres nodes in the visible area.
  // Focus mode keeps the same graphW as graph mode so switching between the two
  // doesn't restart the simulation and scramble node positions.
  const graphW =
    isAssistTab && (assistSidePanel === "graph" || assistSidePanel === "focus")
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
  const NON_ENTAILS_TYPES = ["supports", "conflicts", "undermines", "depends"];
  const effectiveHiddenKeys = hideNonEntailsRels
    ? new Set([...hiddenLegendKeys, ...NON_ENTAILS_TYPES])
    : hiddenLegendKeys;

  const advanceWorkflow = () => {
    let next = WORKFLOW_NEXT_PHASE[workflowPhase];
    if (hideNonEntailsRels && next === "suggestRelations")
      next = WORKFLOW_NEXT_PHASE["suggestRelations"];
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
        clusterSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
    }
  };

  const textState =
    tab === "history" ? stateAtRound(state, historyRound) : state;

  // Props shared by both the assist-side and analyze-mode TextPanel instances.
  const showingTextPanel = isWide
    ? isAssistTab
      ? assistSidePanel === "text"
      : showText
    : tab === "text";
  const textPanelProps = {
    isWide,
    clusterSectionRef,
    scrollToRelationsKey,
    state: textState,
    hiddenLegendKeys: effectiveHiddenKeys,
    hideNonEntailsRels,
    weights: effectiveWeights,
    selected,
    onSelect: handleSelectNode,
    selectedRel,
    onSelectRel: handleSelectRel,
    onEditRequest: handleEditRequest,
    onEditRelRequest: setEditingRel,
    onWithdrawRequest: handleWithdrawRequest,
    onWithdrawRelRequest: handleWithdrawRelRequest,
    onAddElement: handleAddElement,
    onAddRelation: handleAddRelation,
    recentlyAdded,
    recentlyAddedRel,
    showTabNav,
    expandAllKey,
    allExpanded,
  };

  const graphPanelCommonProps = {
    state,
    positions,
    hiddenLegendKeys: effectiveHiddenKeys,
    setHiddenLegendKeys,
    selected,
    onSelect: handleSelectNode,
    selectedRel,
    onSelectRel: handleSelectRel,
    onAddElement: handleAddElement,
    onAddRelation: handleAddRelation,
    onDeleteRelationsByArgId: handleDeleteRelationsByArgId,
    onQuestionnaireSelectAnswer: handleQuestionnaireSelectAnswer,
    recentlyAdded,
    onScrollToRelations: scrollToRelations,
    onRejectElements: handleRejectElements,
    onRejectRelations: handleRejectRelations,
    onApplyRethonEquilibrium: handleApplyRethonEquilibrium,
    weights: effectiveWeights,
    equilibriumPreviewWithdrawnIds:
      tab === "simulateRethon" ? equilibriumPreviewWithdrawnIds : null,
    onSetEquilibriumPreview: setEquilibriumPreviewWithdrawnIds,
    onRoundChange: setHistoryRound,
    isWide,
    onCtrlSecondSelect: setAddBarCtrlTo,
    ready,
    isSample,
    hideNonEntailsRels,
  };

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: 16,
        opacity: ready ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}
    >
      {!LLM_ENABLED && (
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
          {isSample
            ? "No LLM API connection — pre-set examples shown in the Assist Tabs and the Matrix Tab"
            : "No LLM API connection — AI-assistance is disabled"}
        </div>
      )}
      <AppHeader
        round={state.round}
        topic={state.topic}
        model={state.model}
        tab={tab}
        setTab={handleSetTab}
        showText={showText}
        setShowText={setShowText}
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
        showTabNav={showTabNav}
        setShowTabNav={setShowTabNav}
        allExpanded={allExpanded}
        onExpandAll={() => {
          setAllExpanded((v) => !v);
          setExpandAllKey((k) => k + 1);
        }}
        hideNonEntailsRels={hideNonEntailsRels}
        setHideNonEntailsRels={setHideNonEntailsRels}
        weights={weights}
        weightsChanged={weightsChanged}
        onWeightsChange={setWeights}
        onResetWeights={() => setWeights(DEFAULT_WEIGHTS)}
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
          <div
            style={{
              width: "50%",
              flexShrink: 0,
              borderRight: `1px solid ${C.border}`,
              paddingRight: 12,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <GraphPanel
              {...graphPanelCommonProps}
              tab="graph"
              workflowPhase={null}
              onAdvanceWorkflow={null}
              nextPhaseIsEnabled={false}
              onCtrlSecondSelect={setAddBarCtrlTo}
            />
          </div>
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

      {isWide && !isAssistTab && (
        <AddBar
          elements={state.elements.filter((e) =>
            ["active", "revised"].includes(e.status),
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
