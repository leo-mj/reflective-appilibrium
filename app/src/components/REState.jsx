import { useState, useRef, useEffect, useCallback } from "react";
import { C } from "../constants/colors.js";
import { LLM_ENABLED } from "../config.js";
import { useStablePositions } from "../hooks/useStablePositions.js";
import { useWindowSize } from "../hooks/useWindowSize.js";
import { useCoarseDims } from "../hooks/useCoarseDims.js";
import { useSplitRatio } from "../hooks/useSplitRatio.js";
import { stateAtRound, linkableElements } from "../utils/stateUtils.js";
import { useREActions } from "../hooks/useREActions.js";
import { useAutosaveDraft } from "../hooks/useAutosaveDraft.js";
import { useBackendCapabilities } from "../hooks/useBackendCapabilities.js";
import { ASSIST_TABS, SIMULATE_TABS } from "../constants/tabConstants.jsx";
import { downloadMarkdown } from "../utils/exportMarkdown.js";
import { saveSession } from "../utils/sessionsClient.js";
import {
  completesIteration,
  nextPhaseEnabled,
  nextWorkflowPhase,
} from "../utils/workflowUtils.js";
import { AppHeader } from "./AppHeader.jsx";
import { TextPanel } from "./TextPanel.jsx";
import { GraphPanel } from "./GraphPanel.jsx";
import { GuidedTour } from "./tour/GuidedTour.jsx";
import { sheetHeight } from "./tour/tourZ.js";
import { useTourResizing, useTourWidth } from "./tour/tourWidth.js";
import { EditModals } from "./user_edits/EditModals.jsx";
import { GroupModal } from "./user_edits/GroupModal.jsx";
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
  // Whether the narrow tour's sheet is at its taller height, which is how much
  // of the bottom edge the app has to keep clear of it.
  const [tourExpanded, setTourExpanded] = useState(false);
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
    handleSaveReview,
    handleDiscardReview,
    handleApplyRethonEquilibrium,
    handleImportFile,
    handleCreateGroup,
    handleToggleGroup,
    handleUngroup,
    handleRemoveFromGroup,
    handleSaveGroup,
    handleEditGroupRequest,
    editingGroup,
    setEditingGroup,
    handleUndo,
    canUndo,
    handleRedo,
    canRedo,
  } = useREActions(initialState);

  // What this backend actually allows, which build-time flags cannot say.
  const capabilities = useBackendCapabilities();

  // Not the sample: it is a fixed demonstration anyone can reload from the home
  // page, and autosaving it would bury the visitor's own work under it.
  useAutosaveDraft(state, !isSample);

  useEffect(() => {
    const onKeyDown = (e) => {
      // Never while typing: in a textarea these are the editor's own undo.
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT")
        return;
      if (!(e.ctrlKey || e.metaKey)) return;

      // Ctrl/Cmd+Shift+Z, and Ctrl+Y for the Windows habit.
      const isRedo =
        (e.key === "z" && e.shiftKey) || (e.key === "y" && !e.shiftKey);
      const isUndo = e.key === "z" && !e.shiftKey;

      if (isRedo) {
        e.preventDefault();
        handleRedo();
      } else if (isUndo) {
        e.preventDefault();
        handleUndo();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo]);

  const dims = useWindowSize();
  const isWide = dims.w > 768 && dims.h > 500;
  // The same tour either way; what differs is where the screen has room for it.
  // Wide reads it down a column beside the graph, narrow along a sheet under
  // it, and the app pads itself by whichever edge it has given away.
  const wideTour = isWide && tourActive;
  const narrowTour = !isWide && tourActive;
  const tourSheetH = narrowTour ? sheetHeight(dims.h, tourExpanded) : 0;
  // Both from the tour's own store, so the room made for the column and the
  // column itself can never disagree — see the sheet's height above, which is
  // the same arrangement worked out from one function instead.
  const tourWidth = useTourWidth();
  const tourResizing = useTourResizing();
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
  // Where the central divider sits, and how wide that leaves the panel on the
  // fixed side of it. Which side that is differs by mode, and is the same thing
  // the section below orders the two panels by.
  const {
    rowRef,
    ratio: splitRatio,
    panelWidth,
    dividerProps,
  } = useSplitRatio(usesSidePanel ? "right" : "left");

  /** The workspace row, inside the app's own 16px padding. */
  const rowW = dims.w - 32;
  // graphW must match the actual rendered width of the graph SVG so the force
  // simulation centres nodes in the visible area — hence the divider's own
  // width off the end, and the reader's split rather than an even one.
  // Focus mode keeps the same graphW as graph mode so switching between the two
  // doesn't restart the simulation and scramble node positions.
  const graphW = sideGraphIsFull
    ? rowW
    : hasSidePanel || (usesSidePanel && assistSidePanel === "focus")
      ? (1 - splitRatio) * rowW - 12
      : rowW;
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

  // Where pressing on goes, computed here and handed down rather than worked out
  // again in the button: the label and the destination have to be the same thing.
  const workflowNextPhase = nextWorkflowPhase(workflowPhase, {
    loops: workflowLoops,
    hideNonEntailsRels,
  });
  const advanceWorkflow = () => {
    // Counted on leaving the iteration's last phase, not on arriving at its
    // first — the review sits between the two, and an iteration the workflow
    // pauses to read must still count as one that happened.
    if (completesIteration(workflowPhase, hideNonEntailsRels))
      setWorkflowLoops((n) => n + 1);
    setWorkflowPhase(workflowNextPhase);
    setTab(workflowNextPhase);
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
    // The panel is where a collapsed group's members are still spelled out, so
    // it gets the same handles the canvas chips have.
    onToggleGroup: handleToggleGroup,
    onEditGroupRequest: handleEditGroupRequest,
    onUngroup: handleUngroup,
    onRemoveFromGroup: handleRemoveFromGroup,
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
    onSaveReview: handleSaveReview,
    onDiscardReview: handleDiscardReview,
    onApplyRethonEquilibrium: handleApplyRethonEquilibrium,
    weights: effectiveWeights,
    equilibriumPreviewWithdrawnIds:
      tab === "simulateRethon" ? equilibriumPreviewWithdrawnIds : null,
    onSetEquilibriumPreview: setEquilibriumPreviewWithdrawnIds,
    onRoundChange: setHistoryRound,
    focus: graphFocus,
    isWide,
    onCtrlSecondSelect: setAddBarCtrlTo,
    onCreateGroup: handleCreateGroup,
    onToggleGroup: handleToggleGroup,
    onUngroup: handleUngroup,
    onEditGroupRequest: handleEditGroupRequest,
    ready,
    isSample,
    hideNonEntailsRels,
    verifyArguments,
  };

  // The panel the tab is about: the graph, history or cluster view in analyze
  // mode, the workflow panel on an assist or simulate tab. Bound here rather
  // than written inline because the section below places it on either side of
  // its companion depending on which of those two it is.
  const mainPanel = (isWide || tab !== "text") && !sideGraphIsFull && (
    <GraphPanel
      {...graphPanelCommonProps}
      tab={tab}
      workflowPhase={workflowPhase}
      workflowNextPhase={workflowNextPhase}
      onAdvanceWorkflow={advanceWorkflow}
      nextPhaseIsEnabled={workflowNextPhaseEnabled}
      isFullscreen={!showingTextPanel}
      // The assist and simulate tabs hand their own graph the toggle above;
      // here it is the text panel that folds away. When narrow the text is a
      // tab of its own, with nothing beside it to reclaim.
      onToggleFullscreen={
        isWide && !usesSidePanel ? () => setShowText((s) => !s) : null
      }
      fullscreenHides="text panel"
    />
  );

  // Only ever between two panels: a boundary with nothing on the far side of it
  // is a line the reader cannot move and should not be looking for.
  const showDivider =
    isWide && !!mainPanel && (showingSideGraph || showingTextPanel);
  // It carries the boundary itself, which is why neither panel draws one on the
  // edge they share: two lines twelve pixels apart read as a gutter with
  // something wrong in it. The span inside is the line; the box around it is
  // what the pointer has to hit. See {@link module:hooks/useSplitRatio}.
  const divider = showDivider && (
    <div {...dividerProps}>
      <span className="split-divider-line" />
    </div>
  );

  return (
    // <main>, not <div>: this is the app's one main landmark, which lets
    // assistive tech skip straight to it. Purely semantic — a block container
    // either way, so nothing about the layout changes.
    <main
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
        // The tour is fixed to one edge — the left on a wide screen, the bottom
        // on a narrow one. Padding the app by what it takes keeps everything it
        // points at, and the graph it is read against, out from under it.
        paddingLeft: wideTour ? tourWidth + 16 : 16,
        paddingBottom: narrowTour ? tourSheetH + 16 : 16,
        opacity: ready ? 1 : 0,
        // The eased padding is for the tour appearing and going away. It is
        // wrong for one being dragged: the column would follow the pointer with
        // the app trailing a third of a second behind it, which reads as the
        // two having come apart.
        transition: tourResizing
          ? "opacity 0.6s ease"
          : "opacity 0.6s ease, padding-left 0.35s ease, padding-bottom 0.3s ease",
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
        canSaveToServer={capabilities.sessions}
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
        onRedo={handleRedo}
        canRedo={canRedo}
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
        hideTabBar={tourHidesChrome}
        tourMenuOpen={tourActive && !!tourChrome.menu}
      />

      <section
        ref={rowRef}
        aria-label="Reflective equilibrium workspace"
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: isWide ? "row" : "column",
          // The divider stands in for the gap rather than sitting inside one:
          // an easier target to hit must not cost the panels any width, and a
          // draggable line with dead space either side of it is a line the
          // pointer keeps missing.
          gap: showDivider ? 0 : 12,
        }}
      >
        {/* Order matters, and it is the one thing that differs between the two
            modes. Analyze reads left to right — the text beside the graph. An
            assist or simulate tab is the thing being worked in, so it is
            anchored to the left edge and whatever accompanies it, graph or
            text, sits to its right; that keeps the tab still while the header's
            Graph/Text switch changes what is beside it. `usesSidePanel` is the
            same flag the companion panel itself is chosen by. */}
        {usesSidePanel && mainPanel}
        {usesSidePanel && divider}
        {isWide && showingSideGraph && (
          <div
            style={{
              width: sideGraphIsFull ? "100%" : panelWidth,
              flexShrink: 0,
              // No border on the shared edge: the divider beside it is the
              // boundary, and draws it.
              ...(sideGraphIsFull ? {} : { paddingLeft: 12 }),
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <GraphPanel
              {...graphPanelCommonProps}
              tab="graph"
              workflowPhase={null}
              workflowNextPhase={null}
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
        {showingTextPanel && (
          <TextPanel
            {...textPanelProps}
            side={usesSidePanel ? "right" : "left"}
            width={panelWidth}
          />
        )}
        {!usesSidePanel && divider}
        {!usesSidePanel && mainPanel}
      </section>

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
        layout={isWide ? "column" : "sheet"}
        onExpandChange={setTourExpanded}
      />

      {editingGroup && (
        <GroupModal
          group={editingGroup === "new" ? null : editingGroup}
          elements={linkableElements(state.elements)}
          groups={state.groups ?? []}
          onSave={handleSaveGroup}
          onCancel={() => setEditingGroup(null)}
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
    </main>
  );
}
