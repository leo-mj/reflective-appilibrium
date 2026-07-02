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
  detectArguments: "Workflow Step: Detect Arguments",
  suggestRelations: "Workflow Step: Suggest Relations",
};

export const WORKFLOW_NEXT_PHASE = {
  elicitJudgments: "suggestPrinciples",
  suggestPrinciples: "detectArguments",
  detectArguments: "suggestRelations",
  suggestRelations: "elicitJudgments",
};
