/**
 * @fileoverview Right-side panel: renders the active tab content (graph, history, clusters, or AI workflows).
 * @module components/GraphPanel
 */

import { lazy, Suspense, useState } from "react";
import { APP_ENV, LLM_ENABLED } from "../config.js";
import { C } from "../constants/colors.js";
import { Graph } from "./Graph.jsx";
import { HistoryTab } from "./HistoryTab.jsx";
import { ClusterTab } from "./ClusterTab.jsx";
import { Legend } from "./graphs_shared/Legend.jsx";
import { ASSIST_TABS, SIMULATE_TABS } from "../constants/tabConstants.jsx";

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
  ready,
  isSample,
  recentlyAdded,
  weights,
  verifyArguments,
}) {
  const [useDummyAssist, setUseDummyAssist] = useState(false);
  const suggestionsDisabled = !LLM_ENABLED && !isSample;
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
        <Legend
          hiddenLegendKeys={hiddenLegendKeys}
          setHiddenLegendKeys={setHiddenLegendKeys}
          hideNonEntailsRels={hideNonEntailsRels}
        />
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
        {tab === "matrix" && (
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
