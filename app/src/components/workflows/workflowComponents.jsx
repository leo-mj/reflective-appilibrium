import { useState, useEffect } from "react";
import {
  WORKFLOW_NEXT_PHASE,
  WORKFLOW_PHASE_LABELS,
} from "../../utils/workflowUtils.js";
import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";
import { quickScore } from "../../utils/simulateRethonClient.js";

/**
 * Shows account (A) and systematicity (S) deltas for accepting one suggestion.
 * Calls `quick_score` with a temporary element appended and subtracts the
 * pre-computed baseline.  Renders nothing while loading or when scoring is
 * unavailable.
 */
export function ScoreDeltaBadge({
  state,
  text,
  type,
  confidence,
  baseline,
  weights,
}) {
  const [delta, setDelta] = useState(null);

  useEffect(() => {
    if (baseline == null) return;
    let cancelled = false;
    const prefix = type === "principle" ? "P" : "J";
    const maxNum = Math.max(
      0,
      ...state.elements
        .map((e) => parseInt(e.id.slice(1)))
        .filter((n) => !isNaN(n)),
    );
    const tempElement = {
      id: `${prefix}${maxNum + 1}`,
      type,
      status: "active",
      confidence: confidence ?? 0.67,
      origin: "llm",
      text,
      addedRound: state.round,
    };
    quickScore([...state.elements, tempElement], state.relations, weights).then(
      (scores) => {
        if (!cancelled && scores != null) {
          setDelta({
            account: scores.account - baseline.account,
            systematicity: scores.systematicity - baseline.systematicity,
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [text, baseline, weights]); // eslint-disable-line react-hooks/exhaustive-deps

  if (delta == null) return null;

  const fmtDelta = (v) => `${v > 0 ? "+" : ""}${v.toFixed(3)}`;
  const color = (v) =>
    v > 0.001 ? C.supports : v < -0.001 ? C.conflicts : C.dim;
  return (
    <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: "bold",
          color: color(delta.account),
        }}
      >
        A {fmtDelta(delta.account)}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: "bold",
          color: color(delta.systematicity),
        }}
      >
        S {fmtDelta(delta.systematicity)}
      </span>
    </span>
  );
}

const workflowBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "5px 12px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: "bold",
  background: "transparent",
  color: C.dim,
};

export function ProgressWorkflowBtn({
  nextPhaseIsEnabled,
  workflowPhase,
  advanceWorkflow,
  hideNonEntailsRels = true,
}) {
  if (!workflowPhase) return null;
  let label = WORKFLOW_PHASE_LABELS[WORKFLOW_NEXT_PHASE[workflowPhase]];
  if (workflowPhase === "detectArguments" && hideNonEntailsRels) {
    label = "Workflow Step: Elicit Judgments";
  }
  const tooltipText =
    !nextPhaseIsEnabled && workflowPhase === "elicitJudgments"
      ? "Add at least 3 judgments to continue"
      : null;
  return (
    <Tooltip text={tooltipText}>
      <span style={{ display: "inline-flex" }}>
        <button
          onClick={advanceWorkflow}
          disabled={!nextPhaseIsEnabled}
          style={{
            ...workflowBtnStyle,
            color: nextPhaseIsEnabled ? C.supports : C.dim,
            borderColor: nextPhaseIsEnabled ? C.supports : C.border,
            cursor: nextPhaseIsEnabled ? "pointer" : "not-allowed",
          }}
        >
          {label} →
        </button>
      </span>
    </Tooltip>
  );
}
