/**
 * @fileoverview Right-side panel: renders the active tab content (graph, history, clusters, or AI workflows).
 * @module components/GraphPanel
 */

import { lazy, Suspense, useState } from "react";
import { APP_ENV, LLM_ENABLED, MATRIX_ENABLED } from "../config.js";
import { C } from "../constants/colors.js";
import { Graph } from "./Graph.jsx";
import { HistoryTab } from "./HistoryTab.jsx";
import { ClusterTab } from "./ClusterTab.jsx";
import { Legend } from "./graphs_shared/Legend.jsx";
import { Tooltip } from "./Tooltip.jsx";
import { ExpandIcon, CollapseIcon } from "./Icons.jsx";
import { ASSIST_TABS, SIMULATE_TABS } from "../constants/tabConstants.jsx";

/**
 * Hands the whole row to the graph by folding away whatever sits beside it,
 * and back again.
 *
 * This used to be a "Hide text" / "Show text" entry buried in the burger menu,
 * where nobody looking at a cramped graph would think to find it — and where
 * the only way back was to remember the same menu.
 *
 * @param {string} hides - What folds away, named for the tooltip. Which panel
 *   that is depends on the tab: the text beside an analyze graph, the workflow
 *   panel beside the assist and simulate graphs.
 */
function FullscreenButton({ isFullscreen, onClick, hides }) {
  return (
    <Tooltip
      text={
        isFullscreen
          ? `Shrink the graph and bring the ${hides} back`
          : `Give the graph the full width by hiding the ${hides}`
      }
    >
      <button
        onClick={onClick}
        aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
        aria-pressed={isFullscreen}
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 4,
          border: `1px solid ${C.border}`,
          background: C.panel,
          color: C.dim,
          cursor: "pointer",
          padding: 0,
        }}
      >
        {isFullscreen ? <CollapseIcon size={16} /> : <ExpandIcon size={16} />}
      </button>
    </Tooltip>
  );
}

const CoherenceMatrixTab = lazy(() =>
  import("./CoherenceMatrixTab.jsx").then((m) => ({
    default: m.CoherenceMatrixTab,
  })),
);

const JudgmentElicitTab = lazy(() =>
  import("./workflows/JudgmentElicitTab.jsx").then((m) => ({
    default: m.JudgmentElicitTab,
  })),
);

const PrincipleSuggestTab = lazy(() =>
  import("./workflows/PrincipleSuggestTab.jsx").then((m) => ({
    default: m.PrincipleSuggestTab,
  })),
);

const RelationSuggestTab = lazy(() =>
  import("./workflows/RelationSuggestTab.jsx").then((m) => ({
    default: m.RelationSuggestTab,
  })),
);

// Replace RelationsSuggestTab with DetectArgumentsTab?
const DetectArgumentsTab = lazy(() =>
  import("./workflows/DetectArgumentsTab.jsx").then((m) => ({
    default: m.DetectArgumentsTab,
  })),
);

const SimulateRethonTab = lazy(() =>
  import("./workflows/SimulateRethonTab.jsx").then((m) => ({
    default: m.SimulateRethonTab,
  })),
);

const QuestionnaireTab = lazy(() =>
  import("./workflows/QuestionnaireTab.jsx").then((m) => ({
    default: m.QuestionnaireTab,
  })),
);

export function GraphPanel({
  tab,
  state,
  positions,
  hiddenLegendKeys,
  setHiddenLegendKeys,
  selected,
  onSelect,
  selectedRel,
  onSelectRel,
  onAddElement,
  onReviseElementText,
  onAddRelation,
  onDeleteRelationsByArgId,
  onQuestionnaireSelectAnswer,
  onScrollToRelations,
  onRejectElements,
  onRejectRelations,
  onApplyRethonEquilibrium,
  equilibriumPreviewWithdrawnIds,
  onSetEquilibriumPreview,
  onRoundChange,
  isWide,
  workflowPhase,
  onAdvanceWorkflow,
  nextPhaseIsEnabled,
  hideNonEntailsRels,
  onCtrlSecondSelect,
  onEditRequest,
  onWithdrawRequest,
  onReinstate,
  ready,
  isSample,
  recentlyAdded,
  weights,
  verifyArguments,
  isFullscreen,
  onToggleFullscreen,
  fullscreenHides = "panel beside it",
}) {
  const [useDummyAssist, setUseDummyAssist] = useState(false);
  const suggestionsDisabled = !LLM_ENABLED && !isSample;
  // True whenever the suggestions on screen came from the sample fixtures
  // rather than a live model — the same condition makeLLMClient branches on.
  // Note this covers demo builds, where LLM_ENABLED is false and the "Use
  // sample data" toggle is never rendered: everything is sample data there,
  // so anything that would need a live call must stay hidden.
  const suggestionsAreSample = !LLM_ENABLED || useDummyAssist;
  const autoFetch = !!workflowPhase;
  const isAssistPanel =
    ASSIST_TABS.includes(tab) || SIMULATE_TABS.includes(tab);
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
      {!isAssistPanel && (
        // One row: the legend takes what it needs and wraps, the full-screen
        // toggle stays pinned to the right edge above the graph.
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Legend
              hiddenLegendKeys={hiddenLegendKeys}
              setHiddenLegendKeys={setHiddenLegendKeys}
              hideNonEntailsRels={hideNonEntailsRels}
            />
          </div>
          {onToggleFullscreen && (
            <FullscreenButton
              isFullscreen={isFullscreen}
              onClick={onToggleFullscreen}
              hides={fullscreenHides}
            />
          )}
        </div>
      )}
      {APP_ENV === "dev" &&
        isAssistPanel &&
        isSample &&
        state.model !== "questionnaire" && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: C.dim,
              padding: "4px 0 2px",
              userSelect: "none",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={useDummyAssist}
              onChange={(e) => setUseDummyAssist(e.target.checked)}
              style={{ accentColor: C.supports, cursor: "pointer" }}
            />
            Use sample data
          </label>
        )}
      <div style={{ flex: 1, minHeight: 0, marginTop: 4 }}>
        {tab === "graph" && (
          <Graph
            state={state}
            hiddenLegendKeys={hiddenLegendKeys}
            positions={positions}
            selected={selected}
            onSelect={onSelect}
            selectedRel={selectedRel}
            onSelectRel={onSelectRel}
            onAddElement={onAddElement}
            onAddRelation={onAddRelation}
            onEditRequest={onEditRequest}
            onWithdrawRequest={onWithdrawRequest}
            onReinstate={onReinstate}
            onCtrlSecondSelect={onCtrlSecondSelect}
            ready={ready}
            recentlyAdded={recentlyAdded}
            hideNonEntailsRels={hideNonEntailsRels}
            equilibriumPreviewWithdrawnIds={equilibriumPreviewWithdrawnIds}
          />
        )}
        {tab === "history" && (
          <HistoryTab
            state={state}
            positions={positions}
            onRoundChange={onRoundChange}
            isWide={isWide}
            hideNonEntailsRels={hideNonEntailsRels}
          />
        )}
        {tab === "clusters" && (
          <ClusterTab
            state={state}
            positions={positions}
            hideNonEntailsRels={hideNonEntailsRels}
          />
        )}
        {MATRIX_ENABLED && tab === "matrix" && (
          <Suspense fallback={null}>
            <CoherenceMatrixTab
              state={state}
              suggestionsDisabled={suggestionsDisabled}
            />
          </Suspense>
        )}
        {tab === "suggestRelations" && (
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
              useDummy={useDummyAssist}
              suggestionsAreSample={suggestionsAreSample}
              suggestionsDisabled={suggestionsDisabled}
            />
          </Suspense>
        )}
        {tab === "suggestPrinciples" && (
          <Suspense fallback={null}>
            <PrincipleSuggestTab
              state={state}
              onAddElement={onAddElement}
              onRejectElements={onRejectElements}
              autoFetch={autoFetch}
              workflowPhase={workflowPhase}
              onAdvanceWorkflow={onAdvanceWorkflow}
              nextPhaseIsEnabled={nextPhaseIsEnabled}
              useDummy={useDummyAssist}
              suggestionsAreSample={suggestionsAreSample}
              suggestionsDisabled={suggestionsDisabled}
              weights={weights}
            />
          </Suspense>
        )}
        {tab === "elicitJudgments" && (
          <Suspense fallback={null}>
            <JudgmentElicitTab
              state={state}
              onAddElement={onAddElement}
              onRejectElements={onRejectElements}
              autoFetch={autoFetch}
              workflowPhase={workflowPhase}
              onAdvanceWorkflow={onAdvanceWorkflow}
              nextPhaseIsEnabled={nextPhaseIsEnabled}
              useDummy={useDummyAssist}
              suggestionsAreSample={suggestionsAreSample}
              suggestionsDisabled={suggestionsDisabled}
              weights={weights}
            />
          </Suspense>
        )}
        {tab === "simulateRethon" && (
          <Suspense fallback={null}>
            <SimulateRethonTab
              state={state}
              onApplyRethonEquilibrium={onApplyRethonEquilibrium}
              onSetEquilibriumPreview={onSetEquilibriumPreview}
              weights={weights}
            />
          </Suspense>
        )}
        {tab === "detectArguments" && (
          <Suspense fallback={null}>
            <DetectArgumentsTab
              state={state}
              useDummy={useDummyAssist}
              verifyArguments={verifyArguments}
              onAddElement={onAddElement}
              onReviseElementText={onReviseElementText}
              onAddRelation={onAddRelation}
              onDeleteRelationsByArgId={onDeleteRelationsByArgId}
              autoFetch={autoFetch}
              workflowPhase={workflowPhase}
              onAdvanceWorkflow={onAdvanceWorkflow}
              nextPhaseIsEnabled={nextPhaseIsEnabled}
              hideNonEntailsRels={hideNonEntailsRels}
            />
          </Suspense>
        )}
        {tab === "questionnaire" && (
          <Suspense fallback={null}>
            <QuestionnaireTab
              state={state}
              onSelectAnswer={onQuestionnaireSelectAnswer}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
