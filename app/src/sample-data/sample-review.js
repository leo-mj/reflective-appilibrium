// Sample process reviews for the ProcessReviewTab.
// Topic: obligations to future generations (matches sample-state.js).
// Used automatically in PROD, or in DEV when the "Use sample data" toggle is on.
//
// Two readings, and which one is served depends on whether the visitor has
// already accepted any — because the series is the feature, and a demo that
// cannot show a review picking up an earlier one shows only half of it.
//
// The series is *not* demonstrated by seeding a review into sample-state.js.
// That was tried and it misleads: every other assist tab opens empty, so a
// Review tab that opens with something already banked reads as a review the
// visitor accepted, and rejecting one then leaves a review still sitting under
// "Saved reviews" — which looks exactly like the rejection was ignored.

import { reviewsOf } from "../utils/stateUtils.js";

const MODEL = "claude-opus-5";

/** A first reading of the sample process, standing on its own. */
const FIRST_READING = {
  headline:
    "The presentist line was dismantled piece by piece, leaving proximity-modulated obligation as the load-bearing centre.",
  arc: "The process opened with two incompatible starting points and spent its middle rounds taking one of them apart. J1 and J3 arrived in round 1 as confident verdicts about waste and resource depletion; J6 arrived alongside them denying that anyone who does not yet exist can be wronged at all. P4 came in at round 2 as J6's principled backing and J11 at round 3 as the reductive version of the same thought — all three are now withdrawn. Nothing replaced them, and that is the substantive result: the presentist option was not defeated by a counter-argument so much as abandoned once it had been made explicit enough to inspect.\n\nWhat took the centre instead was assembled from round 3 onward and now has three layers. P1 sets a sufficientarian floor; P3 and P5 make the obligation turn on uncertainty and on being affected rather than on temporal distance; and P6, the latest, separates the strength of an obligation from its existence. That last move is what lets J7's parental asymmetry and J10's refusal to discount for distance both stand, which the earlier rounds could not manage together. The range of views under consideration widened through round 6 as the background theories T1 and T2 came in, then narrowed — rounds 7 and 8 refined what was already there rather than opening anything new.",
  surprises:
    "P3 was revised rather than withdrawn in round 4, the one place this process repaired a principle instead of replacing it, and it is what kept the uncertainty route alive after P4 fell. The genuinely unexpected turn is J13, the procreation asymmetry, arriving in round 7. Nothing in the first six rounds pointed at it: the process had been about what is owed to people who will exist, and J13 asks whether there is any reason to bring them about at all. It has been recorded and then left almost entirely unconnected.",
  missed:
    "J13 is the clearest case — added in round 7 and related to nothing, so the question it opens, whether the asymmetry undercuts P5's 'all who will be affected', is on the page but not pursued. J5 and J9 are two versions of one concessive thought, one about uncertainty and one about non-identity, and have never been related to each other. And J6, J11 and P4 were each withdrawn without a relation recording what defeated them, which leaves the reason the presentist line collapsed visible only in the round log and not in the graph.",
  method:
    "The judgments are almost all the user's own and the principles mostly the model's, with P5 and P6 accepted as offered rather than reworded. Confidence was set deliberately across the board rather than left at the default. The process added steadily and revised rarely: J4 and P3 are the only two revisions in eight rounds.",
};

/**
 * A second reading, written as one would be in the demo: the visitor has
 * accepted a review and asked again without the process having moved, so it
 * reports exactly that and takes up what the first one left open.
 */
const SECOND_READING = {
  headline:
    "No rounds have passed since the last reading, so what stands out is which of its openings are still open.",
  arc: "Nothing has moved since the previous review. The process is still at round 8 and no element or relation has been added, revised or withdrawn in between, so this is not an update but a second look — and what a second look can offer is a sharper account of where the position is stable and where it only appears to be.\n\nThe three-layer centre — P1's floor, P3 and P5 on uncertainty and on being affected, P6 separating strength from existence — is stable in the sense that nothing currently attacks it. It is not stable in the sense of being tied together: P1 has no recorded relation to either P5 or P6, so the floor and the scope of the obligation are two commitments held side by side rather than one position. The previous reading treated the collapse of the presentist line as the main event, and it was; what it understated is the consequence — the surviving view has never had to answer the objection that defeated its rival, because that objection was never written down anywhere but the log.\n\nThe one genuinely load-bearing element is P6, which three judgments now lean on. Withdraw it and J7 and J10 conflict again immediately.",
  surprises:
    "On a second reading the surprise is not J13 but P3's revision in round 4. It is the only repair in eight rounds, and it came at exactly the moment P4 was on its way out — the process narrowed one principle rather than let a withdrawal take a second one with it. That is a defensive move, and it is the only one in the record.",
  missed:
    "Both openings the previous review named are still open: J13 is still unrelated to P5, and J5 and J9 are still unrelated to each other. Neither has been taken up, which is what one would expect when no rounds have passed. What can be added is that they are the same kind of gap — two elements that bear on one another sitting in different parts of the graph — so in each case the coherence is available for the cost of a single relation.",
  method:
    "Unchanged, necessarily. Worth noting for its own sake: asking for two readings at the same round is itself a choice about how to conduct the process. The record was examined twice before being changed, which is the opposite of the add-steadily pattern the rest of the log shows.",
};

/**
 * Already in the shape `transformResponse` would produce, because
 * `makeLLMClient` serves `dummyData` without transforming it — and a function,
 * because which reading to serve depends on what the visitor has accepted.
 *
 * @param {import('../types.js').REState} state
 */
export default function sampleReview(state) {
  return {
    model: MODEL,
    suggestions: [reviewsOf(state).length ? SECOND_READING : FIRST_READING],
  };
}
