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
