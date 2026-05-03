/**
 * @fileoverview Right-side panel: renders the active tab content (graph, history, clusters, or AI workflows).
 * @module components/GraphPanel
 */

import { lazy, Suspense, useState } from "react";
import { APP_ENV } from "../config.js";
import { C } from "../constants/colors.js";
import { Graph } from "./Graph.jsx";
import { HistoryTab } from "./HistoryTab.jsx";
import { ClusterTab } from "./ClusterTab.jsx";
import { Legend } from "./graphs_shared/Legend.jsx";
import { ASSIST_TABS } from "../constants/tabConstants.jsx";

const CoherenceMatrixTab = lazy(() =>
  import("./CoherenceMatrixTab.jsx").then((m) => ({
    default: m.CoherenceMatrixTab,
  })),
);

const RelationSuggestTab = lazy(() =>
  import("./workflows/RelationSuggestTab.jsx").then((m) => ({
    default: m.RelationSuggestTab,
  })),
);

const PrincipleSuggestTab = lazy(() =>
  import("./workflows/PrincipleSuggestTab.jsx").then((m) => ({
    default: m.PrincipleSuggestTab,
  })),
);

const JudgmentElicitTab = lazy(() =>
  import("./workflows/JudgmentElicitTab.jsx").then((m) => ({
    default: m.JudgmentElicitTab,
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
  isSample,
  recentlyAdded,
}) {
  const [useDummyAssist, setUseDummyAssist] = useState(false);

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
      {!isAssistPanel && <Legend hiddenLegendKeys={hiddenLegendKeys} setHiddenLegendKeys={setHiddenLegendKeys} />}
      {APP_ENV === "dev" && isAssistPanel && isSample && (
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
          Use dummy suggestions
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
          />
        )}
        {tab === "matrix" && (
          <Suspense fallback={null}>
            <CoherenceMatrixTab state={state} />
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
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
