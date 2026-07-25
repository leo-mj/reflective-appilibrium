// Sample relation suggestions for the RelationSuggestTab.
// Topic: obligations to future generations (matches dummy-state.js).
// Used automatically in PROD, or in DEV when the "Use sample data" toggle is on.
// None of these duplicate relations already present in the sample state.

const dummyRelations = {
  model: "claude-fable-5",
  suggestions: [
    {
      from: "J1",
      to: "P1",
      type: "supports",
      explanation:
        "The radioactive waste case is a paradigm instance of leaving the next generation worse off, directly evidencing the sufficientarian threshold principle.",
    },
    {
      from: "J8",
      to: "P1",
      type: "undermines",
      explanation:
        "If humanity went extinct, there would be no next generation to be left worse off — so the sufficientarian threshold by itself cannot explain the wrongness asserted in J8. The extinction case suggests the threshold principle is not the whole story.",
    },
    {
      from: "J9",
      to: "P1",
      type: "undermines",
      explanation:
        "The non-identity problem shows that no particular future person is made worse off by depletion choices, which weakens but does not refute the sufficientarian floor in P1.",
    },
    {
      from: "P3",
      to: "J1",
      type: "undermines",
      explanation:
        "If obligations weaken under uncertainty about future existence, the confident wrongness verdict in J1 becomes harder to sustain, though the case remains compelling given near-certainty of future inhabitants.",
    },
    {
      from: "J3",
      to: "J7",
      type: "undermines",
      explanation:
        "J3 asserts an impartial stewardship duty owed to unknown future persons, which puts pressure on J7's strong partiality toward one's own children — if the general duty is as weighty as J3 claims, the gap J7 posits narrows. P6 makes the underlying tension explicit without resolving it.",
    },
    {
      from: "J2",
      to: "J12",
      type: "supports",
      explanation:
        "Discharging the climate-policy duty in J2 over century timescales requires durable decision-making structures, which is exactly the institutional representation J12 demands.",
    },
    {
      from: "J5",
      to: "J2",
      type: "undermines",
      explanation:
        "J5 allows slight discounting when future existence is uncertain, which modulates without eliminating the strong climate-policy duty in J2.",
    },
    {
      from: "P2",
      to: "J3",
      type: "supports",
      explanation:
        "If probable future persons have moral status, resource-depletion decisions that predictably harm them are morally constrained, lending principled backing to J3.",
    },
  ],
};

export default dummyRelations;
