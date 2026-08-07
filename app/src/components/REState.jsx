import { useState, useRef, useEffect, useCallback } from "react";
import { C } from "../constants/colors.js";
import { LLM_ENABLED } from "../config.js";
import { useStablePositions } from "../hooks/useStablePositions.js";
import { useWindowSize } from "../hooks/useWindowSize.js";
import { useCoarseDims } from "../hooks/useCoarseDims.js";
import { stateAtRound, linkableElements } from "../utils/stateUtils.js";
import { useREActions } from "../hooks/useREActions.js";
import { ASSIST_TABS, SIMULATE_TABS } from "../constants/tabConstants.jsx";
import { downloadMarkdown } from "../utils/exportMarkdown.js";
import { saveSession } from "../utils/sessionsClient.js";
import {
  WORKFLOW_NEXT_PHASE,
  nextPhaseEnabled,
} from "../utils/workflowUtils.js";
import { AppHeader } from "./AppHeader.jsx";
import { TextPanel } from "./TextPanel.jsx";
import { GraphPanel } from "./GraphPanel.jsx";
import { GuidedTour, TOUR_W } from "./tour/GuidedTour.jsx";
import { EditModals } from "./user_edits/EditModals.jsx";
import { AddBar } from "./user_edits/TextTabAddPanel.jsx";
export default function REState({ initialState, isSample, onHome, onReady }) {
  // Graph, not the Assist panel: assist controls are gated on a backend, so in
  // a demo build the old default landed every visitor on dead buttons.
  const [tab, setTab] = useState(
    initialState.model === "questionnaire" ? "questionnaire" : "graph",
  );
  const [hiddenLegendKeys, setHiddenLegendKeys] = useState(new Set());
  const [showText, setShowText] = useState(true);
  // On by default: it carries the text panel's search, and hiding it behind a
  // menu item meant most people never found it.
  const [showTabNav, setShowTabNav] = useState(true);
  const [expandAllKey, setExpandAllKey] = useState(0);
  const [allExpanded, setAllExpanded] = useState(true);
  const [assistSidePanel, setAssistSidePanel] = useState("graph");
  const [historyRound, setHistoryRound] = useState(0);
  const [workflowPhase, setWorkflowPhase] = useState(null);
  const [addBarCtrlTo, setAddBarCtrlTo] = useState(null);
  const [workflowLoops, setWorkflowLoops] = useState(0);
  const [hideNonEntailsRels, setHideNonEntailsRels] = useState(true);
  const [verifyArguments, setVerifyArguments] = useState(true);
  // The home page's "Tutorial" button sets this flag and then loads the demo,
  // so the tour opens on the state it describes rather than on the landing page.
  const [tourActive, setTourActive] = useState(() => {
    if (sessionStorage.getItem("startTour") === "1") {
      sessionStorage.removeItem("startTour");
      return true;
    }
    return false;
  });
  // What the wide tour wants on screen: its opening chapters read against a
  // bare graph, and bring the tab bar, the text panel and the ☰ menu back as
  // each becomes what the reader is being shown.
  const [tourChrome, setTourChrome] = useState({ chrome: true, text: true });
  const [graphFocus, setGraphFocus] = useState(null);
  const focusSeq = useRef(0);
  // A new key on every call, so scrolling back to a section re-frames it even
  // though it names the same elements as last time.
  const focusGraph = useCallback((ids) => {
    focusSeq.current += 1;
    setGraphFocus({ key: focusSeq.current, ids });
  }, []);
  const [equilibriumPreviewWithdrawnIds, setEquilibriumPreviewWithdrawnIds] =
    useState(null);
  const DEFAULT_WEIGHTS = {
    account: 0.35,
    systematicity: 0.55,
    faithfulness: 0.1,
  };
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
    handleReinstateElement,
    withdrawingId,
    setWithdrawingId,
    handleWithdrawRelRequest,
    handleReinstateRelation,
    handleDeleteRelationsByArgId,
    handleAddElement,
    handleReviseElementText,
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
  // The phone gets its own tour, run from the header; this is the wide one.
  const wideTour = isWide && tourActive;
  const tourHidesChrome = wideTour && !tourChrome.chrome;
  // The add bar goes away with the rest of the chrome for the chapters that are
  // about reading the graph — except for the one section that is about adding
  // to it, which asks for it back and rings it.
  const showAddBar = !tourHidesChrome || tourChrome.addBar;
  const isAssistTab = ASSIST_TABS.includes(tab);
  const isSimulateTab = SIMULATE_TABS.includes(tab);
  const usesSidePanel = isAssistTab || isSimulateTab;
  // "graphFull" is "graph" with the workflow panel folded away, so the graph
  // takes the whole row. It is reached from the graph's own full-screen button
  // rather than the header's Text/Graph/Focus switch, which still reads "Graph".
  const sideGraphIsFull = usesSidePanel && assistSidePanel === "graphFull";
  const showingSideGraph =
    usesSidePanel && (assistSidePanel === "graph" || sideGraphIsFull);
  const hasSidePanel =
    isWide &&
    (usesSidePanel
      ? assistSidePanel !== "none" && assistSidePanel !== "focus"
      : showText);
  // graphW must match the actual rendered width of the graph SVG so the force
  // simulation centres nodes in the visible area.
  // Focus mode keeps the same graphW as graph mode so switching between the two
  // doesn't restart the simulation and scramble node positions.
  const graphW = sideGraphIsFull
    ? dims.w - 32
    : usesSidePanel &&
        (assistSidePanel === "graph" || assistSidePanel === "focus")
      ? (dims.w - 44) / 2
      : hasSidePanel
        ? (dims.w - 32) / 2 - 12
        : dims.w - 32;
  // Coarsened first: a phone's viewport height changes on its own, when the URL
  // bar collapses on a scroll or the keyboard comes up, and every one of those
  // would otherwise restart the simulation and drift the nodes under a view
  // that stays put. Rotations and panel toggles are far bigger and still land.
  const simDims = useCoarseDims({ w: graphW, h: dims.h * 0.8 });
  const { positions, ready } = useStablePositions(state, simDims);
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
      if (usesSidePanel) setAssistSidePanel("text");
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
  // While the tour is running it says whether the text panel belongs on screen.
  // It overrides what is rendered rather than `showText` itself: `showText`
  // feeds `graphW`, and moving that would restart the force simulation — the
  // graph would re-settle under the reader at every second section.
  const showingTextPanel = isWide
    ? usesSidePanel
      ? assistSidePanel === "text"
      : wideTour
        ? tourChrome.text
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
    onReinstate: handleReinstateElement,
    onWithdrawRelRequest: handleWithdrawRelRequest,
    onReinstateRel: handleReinstateRelation,
    onAddElement: handleAddElement,
    onAddRelation: handleAddRelation,
    recentlyAdded,
    recentlyAddedRel,
    showTabNav,
    expandAllKey,
    allExpanded,
    showZScores: tab === "history",
    // Present only while the history slider is driving the panel, so the text
    // makes clear it is a past round rather than the live state.
    historyView:
      tab === "history" ? { round: historyRound, maxRound: state.round } : null,
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
    onReviseElementText: handleReviseElementText,
    // Let the graph offer the same per-element actions as the text tab.
    onEditRequest: handleEditRequest,
    onWithdrawRequest: handleWithdrawRequest,
    onReinstate: handleReinstateElement,
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
    focus: graphFocus,
    isWide,
    onCtrlSecondSelect: setAddBarCtrlTo,
    ready,
    isSample,
    hideNonEntailsRels,
    verifyArguments,
  };

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        // dvh, not vh: on a phone `100vh` means the viewport with the URL bar
        // hidden, so the app is drawn 60–90px taller than the screen and its
        // bottom edge — the add bar, the foot of the graph — sits underneath
        // the browser's own chrome. dvh is whatever is actually visible.
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        padding: 16,
        // The tour is a fixed column down the left edge. Padding the app by its
        // width keeps everything it points at out from under it.
        paddingLeft: wideTour ? TOUR_W + 16 : 16,
        opacity: ready ? 1 : 0,
        transition: "opacity 0.6s ease, padding-left 0.35s ease",
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
            ? "No LLM API connection — pre-set examples shown in the Assist Tabs"
            : "No LLM API connection — AI-assistance is disabled, but you can still manually use the app"}
        </div>
      )}
      <AppHeader
        round={state.round}
        topic={state.topic}
        model={state.model}
        tab={tab}
        setTab={handleSetTab}
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
        verifyArguments={verifyArguments}
        setVerifyArguments={setVerifyArguments}
        weights={weights}
        weightsChanged={weightsChanged}
        onWeightsChange={setWeights}
        onResetWeights={() => setWeights(DEFAULT_WEIGHTS)}
        tourActive={tourActive}
        onStartTour={() => setTourActive(true)}
        onCloseTour={() => setTourActive(false)}
        hideTabBar={tourHidesChrome}
        tourMenuOpen={wideTour && tourChrome.menu}
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
        {isWide && showingSideGraph && (
          <div
            style={{
              width: sideGraphIsFull ? "100%" : "50%",
              flexShrink: 0,
              ...(sideGraphIsFull
                ? {}
                : { borderRight: `1px solid ${C.border}`, paddingRight: 12 }),
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
              isFullscreen={sideGraphIsFull}
              onToggleFullscreen={() =>
                setAssistSidePanel(sideGraphIsFull ? "graph" : "graphFull")
              }
              fullscreenHides={
                isSimulateTab ? "simulation panel" : "assist panel"
              }
            />
          </div>
        )}
        {showingTextPanel && <TextPanel {...textPanelProps} />}
        {(isWide || tab !== "text") && !sideGraphIsFull && (
          <GraphPanel
            {...graphPanelCommonProps}
            tab={tab}
            workflowPhase={workflowPhase}
            onAdvanceWorkflow={advanceWorkflow}
            nextPhaseIsEnabled={workflowNextPhaseEnabled}
            isFullscreen={!showingTextPanel}
            // The assist and simulate tabs hand their own graph the toggle
            // above; here it is the text panel that folds away. When narrow the
            // text is a tab of its own, with nothing beside it to reclaim.
            onToggleFullscreen={
              isWide && !usesSidePanel ? () => setShowText((s) => !s) : null
            }
            fullscreenHides="text panel"
          />
        )}
      </div>

      {isWide && !isAssistTab && !isSimulateTab && showAddBar && (
        <AddBar
          elements={linkableElements(state.elements)}
          onAddElement={handleAddElement}
          onAddRelation={handleAddRelation}
          selected={selected}
          ctrlTo={addBarCtrlTo}
          hideNonEntailsRels={hideNonEntailsRels}
        />
      )}

      {/* After the header, so the tour's own headings never come before the
          page's h1 in the reading order. */}
      {isWide && (
        <GuidedTour
          active={tourActive}
          state={state}
          isSample={isSample}
          hideNonEntailsRels={hideNonEntailsRels}
          onClose={() => setTourActive(false)}
          onSetTab={handleSetTab}
          onSelectNode={handleSelectNode}
          onSelectRel={handleSelectRel}
          onSetChrome={setTourChrome}
          onFocusGraph={focusGraph}
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
