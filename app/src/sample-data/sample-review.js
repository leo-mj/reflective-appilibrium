// Sample process reviews for the ProcessReviewTab.
// Topic: obligations to future generations (matches sample-state.js).
// Used automatically in PROD, or in DEV when the "Use sample data" toggle is on.
//
// Two of them, because a review series is the feature: SAMPLE_EARLIER_REVIEW is
// seeded into sample-state.js as an already-accepted review taken at round 4, and
// the suggestion below is what a run at round 8 returns — written so it visibly
// picks the earlier one up, naming what has moved since and what it got wrong.

/** An accepted review from round 4, seeded into the sample state. */
export const SAMPLE_EARLIER_REVIEW = {
  id: "rev-sample-1",
  round: 4,
  headline:
    "Two incompatible starting points are now both explicit, and neither has yet given way.",
  arc: "The first three rounds were about getting the disagreement onto the page rather than settling it. J1 and J3 came in immediately as confident verdicts about waste and resource depletion, and J6 came in alongside them denying that anyone who does not yet exist can be wronged at all. Rounds 2 and 3 gave each side its principle — P1's sufficientarian floor for the first, P4's 'only beings who currently exist' for the second — which is what turned a clash of intuitions into a clash of commitments. P2 and P3 then opened a third route through uncertainty rather than through existence, and it is not yet clear whether that is a way of splitting the difference or a separate position.",
  surprises:
    "J4 was revised rather than withdrawn in round 2, narrowing what is owed to a liveable environment instead of an equal standard of living. That is a concession the earlier rounds did not obviously call for, and it happened before any pressure had been put on the stronger reading.",
  missed:
    "P1 and P4 are the two principles the position now turns on and no relation between them has been recorded, so the central conflict is visible only by reading both. J5 and J9 are close to the same concessive thought and are not related either.",
  method:
    "Judgments are the user's own; both principles that arrived in rounds 2 and 3 came from the model, one of them accepted as offered. Nothing has been withdrawn yet — the process so far has only added.",
  model: "claude-opus-5",
  origin: "claude-opus-5",
};

/**
 * What a run at round 8 returns. Already in the shape `transformResponse` would
 * produce, because `makeLLMClient` serves `dummyData` without transforming it.
 */
const sampleReview = {
  model: "claude-opus-5",
  suggestions: [
    {
      headline:
        "The presentist line was dismantled piece by piece, leaving proximity-modulated obligation as the load-bearing centre.",
      arc: "The round-4 review left the two starting points unresolved. What has happened since is that one of them was taken apart. P4 was withdrawn, J11 — the reductive version of the same thought, offered in round 3 — went with it, and J6 itself was given up. Nothing replaced them, and that is the substantive result: the presentist option was not defeated by a counter-argument so much as abandoned once it had been made explicit enough to inspect.\n\nWhat took the centre instead was assembled from round 3 onward and now has three layers. P1 sets a sufficientarian floor; P3 and P5 make the obligation turn on uncertainty and on being affected rather than on temporal distance; and P6, the latest, separates the strength of an obligation from its existence. That last move is what lets J7's parental asymmetry and J10's refusal to discount for distance both stand, which the earlier rounds could not manage together. The range of views under consideration widened through round 6 as the background theories T1 and T2 came in, then narrowed — rounds 7 and 8 refined what was already there rather than opening anything new.",
      surprises:
        "P3 was revised rather than withdrawn in round 4, the one place this process repaired a principle instead of replacing it, and it is what kept the uncertainty route alive after P4 fell. The genuinely unexpected turn is J13, the procreation asymmetry, arriving in round 7. Nothing in the first six rounds pointed at it: the process had been about what is owed to people who will exist, and J13 asks whether there is any reason to bring them about at all. It has been recorded and then left almost entirely unconnected.",
      missed:
        "J13 is the clearest case — added in round 7 and related to nothing, so the question it opens, whether the asymmetry undercuts P5's 'all who will be affected', is on the page but not pursued. The round-4 review flagged J5 and J9 as two versions of one concessive thought; four rounds later they are still unrelated, so that opportunity is still open. J6, J11 and P4 were each withdrawn without a relation recording what defeated them, which leaves the reason the presentist line collapsed visible only in the round log and not in the graph.",
      method:
        "The judgments are almost all the user's own and the principles mostly the model's, with P5 and P6 accepted as offered rather than reworded. Confidence was set deliberately across the board rather than left at the default. The process added steadily and revised rarely: J4 and P3 are the only two revisions in eight rounds.",
    },
  ],
};

export default sampleReview;
