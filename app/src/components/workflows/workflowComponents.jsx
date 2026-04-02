import {
  WORKFLOW_NEXT_PHASE,
  WORKFLOW_PHASE_LABELS,
} from "../../utils/workflowUtils.js";
import { C } from "../../constants/colors.js";

const workflowBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  height: 36,
  padding: "0 12px",
  boxSizing: "border-box",
  borderRadius: 4,
  border: `1px solid ${C.border}`,
  cursor: "pointer",
  fontSize: 12,
  background: "transparent",
  color: C.dim,
  fontFamily: "inherit",
};

export function ProgressWorkflowBtn({
  nextPhaseIsEnabled,
  workflowPhase,
  advanceWorkflow,
}) {
  if (!workflowPhase) return null;
  return (
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
      {WORKFLOW_PHASE_LABELS[WORKFLOW_NEXT_PHASE[workflowPhase]]} →
    </button>
  );
}
