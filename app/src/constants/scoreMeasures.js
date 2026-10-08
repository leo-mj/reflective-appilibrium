/**
 * @fileoverview The rethon scores, named once: what each is called and what
 * its hover text says, for every surface that shows one — the Simulate tab's
 * score row and chart, History's chart in the text panel, and the names of the
 * text cards' withdrawal bars.
 *
 * **"Achievement (Z)", never "Z-score".** Z is rethon's weighted sum of the
 * three measures below, not a statistical z-score, and a reader who knows the
 * term would read a number of standard deviations into it. The letter stays in
 * brackets because rethon's papers call it Z.
 *
 * The texts use the app's element types rather than rethon's vocabulary:
 * "the elements you accept and reject" for its commitments, and "theory" only
 * with its meaning attached — a consistent set of principles and background
 * theories, which is exact: they are the theory in the scoring (its largest
 * consistent set, `largest_consistent_part`) and, since
 * `backend/services/rethon_theory.py`, the only elements the simulation may
 * build its theory from.
 *
 * The hover texts follow rethon's own definitions (`StandardModel` in
 * `rethon/base.py`, penalties in its `default_model_parameters`), and say
 * what the formulas count rather than what the names suggest: account's
 * small penalty for implying what the reader takes no stand on, systematicity
 * ignoring the commitments, faithfulness charging nothing for a new one and
 * measuring from the simulation's start — the reader's position at Run, not
 * the process's first step (`initial_commitments` in `rethon_simulation.py`).
 *
 * @module constants/scoreMeasures
 */

/** @type {Record<"z"|"account"|"systematicity"|"faithfulness", {label: string, tooltip: string}>} */
export const SCORE_MEASURES = {
  z: {
    label: "Achievement (Z)",
    tooltip:
      "rethon's overall score for a position: account, systematicity and faithfulness, weighted as the ⚖ weights in the Simulate tab set them. Higher is better. Not a statistical z-score.",
  },
  account: {
    label: "Account",
    tooltip:
      "How closely what the theory — the consistent set of principles and background theories being scored — implies matches the elements you accept and reject. Each element you accept or reject that it doesn't imply, or that it contradicts, lowers it. Each element it implies that you take no stand on lowers it a little.",
  },
  systematicity: {
    label: "Systematicity",
    tooltip:
      "How much the theory — the consistent set of principles and background theories being scored — implies, relative to how many principles and background theories it has: fewer implying more scores higher. It depends on the theory alone, not on which elements you accept.",
  },
  faithfulness: {
    label: "Faithfulness",
    tooltip:
      "How much of what you accepted and rejected when the simulation started is kept. Giving up or reversing an element lowers it; taking up a new one doesn't.",
  },
};
