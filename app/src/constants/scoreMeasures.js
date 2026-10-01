/**
 * @fileoverview The rethon scores, named once: what each is called and what
 * its hover text says, for every surface that shows one — the Simulate tab's
 * score row and chart, and History's chart in the text panel.
 *
 * **"Achievement (Z)", never "Z-score".** Z is rethon's weighted sum of the
 * three measures below, not a statistical z-score, and a reader who knows the
 * term would read a number of standard deviations into it. The letter stays in
 * brackets because rethon's papers call it Z.
 *
 * "Principles and background theories" is exact, not a simplification: they
 * are the theory in the scoring and, since `backend/services/rethon_theory.py`,
 * the only elements the simulation may build its theory from.
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
      "How well your principles and background theories account for your current elements: the more of what you accept they imply, the higher.",
  },
  systematicity: {
    label: "Systematicity",
    tooltip:
      "How systematic your principles and background theories are: fewer of them covering more elements scores higher.",
  },
  faithfulness: {
    label: "Faithfulness",
    tooltip:
      "How close your current elements stay to the ones you started with: the fewer given up, the higher.",
  },
};
