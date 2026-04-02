
/*
* In the judgment elicitation phase, the workflow progresses to the next phase only if there are at least three active judgments to work with.
*/
export function nextPhaseEnabled (workflowPhase, state) {
    return workflowPhase !== "elicitJudgments" ||
          state.elements.filter(
            (e) =>
              e.type === "judgment" &&
              e.status !== "withdrawn" &&
              e.status !== "rejected",
          ).length >= 3}


export const WORKFLOW_PHASE_LABELS = {
  elicitJudgments: "Step 1 · Elicit Judgments",
  suggestPrinciples: "Step 2 · Suggest Principles",
  suggestRelations: "Step 3 · Suggest Relations",
};

export const WORKFLOW_NEXT_PHASE = {
  elicitJudgments: "suggestPrinciples",
  suggestPrinciples: "suggestRelations",
  suggestRelations: "elicitJudgments",
};


