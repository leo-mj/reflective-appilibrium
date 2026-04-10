/**
 * @fileoverview Right-side panel: renders the active tab content (graph, history, clusters, or AI workflows).
 * @module components/GraphPanel
 */

import { lazy, Suspense } from "react";
import { LLM_ENABLED, VITE_USE_DUMMY } from "../config.js";
import { Graph } from "./Graph.jsx";
import { HistoryTab } from "./HistoryTab.jsx";
import { ClusterTab } from "./ClusterTab.jsx";
import { Legend } from "./graphs_shared/Legend.jsx";
import { ASSIST_TABS } from "../constants/tabConstants.jsx";

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

export function GraphPanel({
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
