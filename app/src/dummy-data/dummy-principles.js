// Dummy principle suggestions for the PrincipleSuggestTab.
// Topic: obligations to future generations (matches dummy-state.js).
// Used automatically in PROD, or in DEV when the "Use dummy suggestions" toggle is on.

const dummyPrinciples = {
  model: "dummy",
  suggestions: [
    {
      text: "(This is a dummy suggestion.) Each generation must leave future generations no worse off in terms of basic capabilities and resources than it found them.",
      confidence: 1.0,
      covers: ["J1", "J2", "J3"],
      explanation:
        "This sufficientarian floor principle directly captures the wrongness verdicts in J1, J2, and J3 by forbidding depletion that would fall below a threshold of adequate resources.",
    },
    {
      text: "Moral obligations extend to all parties predictably and substantially affected by present decisions, regardless of their temporal location.",
      confidence: 0.67,
      covers: ["J3", "J5", "J8", "J12"],
      explanation:
        "By grounding obligations in predictable impact rather than contemporaneous existence, this principle systematises the duties in J3, J5, J8, and J12 without invoking contested claims about the moral status of non-existent persons.",
    },
    {
      text: "Present decision-makers may permissibly discount future welfare only to the degree warranted by genuine uncertainty about future needs and existence, not for reasons of mere temporal distance.",
      confidence: 0.67,
      covers: ["J5", "J9"],
      explanation:
        "This principle reconciles the qualified discounting allowed in J5 with the non-identity concern in J9 by restricting discounting to epistemic grounds alone.",
    },
  ],
};

export default dummyPrinciples;
