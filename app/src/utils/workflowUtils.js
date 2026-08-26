/*
 * In the judgment elicitation phase, the workflow progresses to the next phase only if there are at least three active judgments to work with.
 */
export function nextPhaseEnabled(workflowPhase, state) {
  return (
    workflowPhase !== "elicitJudgments" ||
    state.elements.filter(
      (e) =>
        e.type === "judgment" &&
        ["active", "revised"].includes(e.status),

    ).length >= 3
  );
}

export const WORKFLOW_PHASE_LABELS = {
  elicitJudgments: "Workflow Step: Elicit Judgments",
  suggestPrinciples: "Workflow Step: Suggest Principles",
  suggestTheories: "Workflow Step: Suggest Theories",
  detectArguments: "Workflow Step: Detect Arguments",
  suggestRelations: "Workflow Step: Suggest Relations",
};

// Theories sit third, after the judgments and principles they have to bear on
// and before the two phases that connect what is on the board: an argument or a
// relation drawn while the theories are still missing is one the user would have
// to come back and draw again.
export const WORKFLOW_NEXT_PHASE = {
  elicitJudgments: "suggestPrinciples",
  suggestPrinciples: "suggestTheories",
  suggestTheories: "detectArguments",
  detectArguments: "suggestRelations",
  suggestRelations: "elicitJudgments",
};
