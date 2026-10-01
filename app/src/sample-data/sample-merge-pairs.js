/**
 * @fileoverview Sample suggestions for the Merge assist tab: the pairs a reader
 * should be offered after merging `public/samples/sample-process-climate-duties.md`
 * into the opening sample process.
 *
 * Written out by hand rather than computed, because what the tab is for is
 * judging whether two differently worded statements make the *same claim*, and
 * the word overlap that `samplePairs` falls back on cannot tell that. Every pair
 * here is one a reader would recognise; three of the five wordings share almost
 * no vocabulary with their partner.
 *
 * **Keyed by wording, not by id.** The ids the second process ends up with
 * depend on how many elements the first one already had, and both fixtures are
 * edited from time to time. Matching on the text keeps the sample working
 * through a renumbering, and — when the reader has merged something else
 * entirely — simply matches nothing, which is what the fallback is for.
 *
 * @module sample-data/sample-merge-pairs
 */

import { isMergeablePair, samplePairs } from "../utils/elementMerge.js";

/** Wording of the element in the opening process, then in the merged-in one. */
const PAIRS = [
  {
    a: "It would be wrong to bury large quantities of radioactive waste without any containment, knowing it will poison groundwater for millennia — long after everyone now living is gone.",
    b: "Leaving radioactive waste unsealed where it will contaminate drinking water for thousands of years is wrong.",
    reason:
      "Both condemn the same act on the same ground: leaving waste uncontained where it will poison water long after we are gone.",
  },
  {
    a: "Climate policies should account for the welfare of people living in 2100 and beyond.",
    b: "When we set climate targets, the wellbeing of people alive in 2100 counts.",
    reason:
      "One says climate policy should account for the welfare of people alive in 2100, the other that it counts when targets are set.",
  },
  {
    a: "Future people's interests should not be discounted merely because of their temporal distance from us.",
    b: "That someone will live later than us is no reason to count their interests for less.",
    reason:
      "Both deny exactly the same thing: that living later is itself a reason to weigh someone's interests less.",
  },
  {
    a: "Each generation has a duty not to leave the next generation worse off than it found things (sufficientarian threshold).",
    b: "No generation may hand on a world in worse condition than the one it inherited.",
    reason:
      "A duty not to leave the next generation worse off than one found things, stated once as a duty and once as a prohibition.",
  },
  {
    a: "Personal identity is not required for moral patienthood — what matters is the capacity for well-being, which future people will have.",
    b: "What makes someone matter morally is the capacity to fare well or badly, not which particular person they turn out to be.",
    reason:
      "Both make the capacity for well-being the ground of moral standing and deny that personal identity is required for it.",
  },
];

const normalise = (text) => text.trim().replace(/\s+/g, " ");

/**
 * The sample pairs, as ids of the state they are being offered for.
 *
 * Falls back to word-overlap pairs when none of the wordings above are on the
 * board — the reader merged some other process, so the curated list has nothing
 * to say about it.
 *
 * @param {import('../types.js').REState} state
 * @param {{ id: string, label: string, members: string[] }[]} processes
 * @returns {{ a: string, b: string, reason: string }[]}
 */
export default function sampleMergePairs(state, processes) {
  const idOf = new Map(state.elements.map((e) => [normalise(e.text), e.id]));
  const found = PAIRS.map(({ a, b, reason }) => ({
    a: idOf.get(normalise(a)),
    b: idOf.get(normalise(b)),
    reason,
  })).filter(
    (p) => p.a && p.b && isMergeablePair(state, processes, p.a, p.b),
  );
  return found.length ? found : samplePairs(state, processes);
}
