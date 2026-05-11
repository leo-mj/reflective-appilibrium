import {
  WORKFLOW_NEXT_PHASE,
  WORKFLOW_PHASE_LABELS,
} from "../../utils/workflowUtils.js";
import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";

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
  nextPhaseLabel,
}) {
  if (!workflowPhase) return null;
  const label =
    nextPhaseLabel ?? WORKFLOW_PHASE_LABELS[WORKFLOW_NEXT_PHASE[workflowPhase]];
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
