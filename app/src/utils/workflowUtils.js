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

// Every phase the workflow can announce as the next one — the five of the
// iteration, plus the review it stops at between iterations.
export const WORKFLOW_PHASE_LABELS = {
  elicitJudgments: "Workflow Step: Elicit Judgments",
  suggestPrinciples: "Workflow Step: Suggest Principles",
  suggestTheories: "Workflow Step: Suggest Theories",
  detectArguments: "Workflow Step: Detect Arguments",
  suggestRelations: "Workflow Step: Suggest Relations",
  processReview: "Workflow Step: Review Process",
};

// The iteration, and only the iteration. Theories sit third, after the judgments
// and principles they have to bear on and before the two phases that connect
// what is on the board: an argument or a relation drawn while the theories are
// still missing is one the user would have to come back and draw again.
//
// The review is deliberately *not* a key here. It runs between iterations rather
// than inside one, and only every fifth time — `nextWorkflowPhase` is what
// inserts it, and is the one place that decides where the workflow goes next.
export const WORKFLOW_NEXT_PHASE = {
  elicitJudgments: "suggestPrinciples",
  suggestPrinciples: "suggestTheories",
  suggestTheories: "detectArguments",
  detectArguments: "suggestRelations",
  suggestRelations: "elicitJudgments",
};

/** How many iterations pass between one process review and the next. */
export const REVIEW_EVERY = 5;

/**
 * Whether this phase is the last of an iteration — which is `detectArguments`
 * when the relations phase is hidden, since the workflow skips over it.
 */
export function completesIteration(phase, hideNonEntailsRels = false) {
  return (
    phase === "suggestRelations" ||
    (phase === "detectArguments" && hideNonEntailsRels)
  );
}

/**
 * Where the workflow goes when the reader presses on.
 *
 * The single source of truth for that, and it has to stay single: the button
 * announces the destination and `advanceWorkflow` travels to it, so a router the
 * label does not follow is a button that lies about what pressing it does. Both
 * read this function — they each had their own copy of the hidden-relations skip
 * before, which is exactly the pair that drifts.
 *
 * Every fifth iteration ends at the process review rather than looping straight
 * back. A review is a reading of how the position has moved, so it is worth
 * having once the process is long enough to have moved and periodically
 * thereafter — which is what the accumulating series of them is for. It stays a
 * stop *between* iterations: passing through advances no round and writes no log
 * entry, so a review still cannot alter the record it describes.
 *
 * @param {string}  phase
 * @param {Object}  [opts]
 * @param {number}  [opts.loops] Iterations completed so far.
 * @param {boolean} [opts.hideNonEntailsRels]
 * @returns {string} The phase to move to.
 */
export function nextWorkflowPhase(
  phase,
  { loops = 0, hideNonEntailsRels = false } = {},
) {
  if (phase === "processReview") return "elicitJudgments";
  if (completesIteration(phase, hideNonEntailsRels))
    return (loops + 1) % REVIEW_EVERY === 0
      ? "processReview"
      : "elicitJudgments";
  return WORKFLOW_NEXT_PHASE[phase];
}
