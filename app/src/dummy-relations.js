// Dummy relation suggestions for the RelationSuggestTab.
// Topic: obligations to future generations (matches dummy-state.js).
// Set VITE_USE_DUMMY=true in .env to use this instead of calling the backend.

const dummyRelations = {
  model: "dummy",
  suggestions: [
    {
      from: "J1",
      to: "P1",
      type: "supports",
      explanation:
        "(This is a dummy suggestion.) The radioactive waste case is a paradigm instance of leaving the next generation worse off, directly evidencing the sufficientarian threshold principle.",
    },
    {
      from: "J8",
      to: "P1",
      type: "depends",
      explanation:
        "The claim that extinction risk wrongs future people presupposes a principle that each generation must not leave the next worse off — without P1 in play the judgment loses its grounding.",
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
      type: "conflicts",
      explanation:
        "J3 asserts a general duty of resource stewardship owed to unknown future persons, whereas J7 restricts strong future-oriented obligations to one's own children — the two yield incompatible verdicts on the scope of intergenerational duty.",
    },
    {
      from: "P5",
      to: "J12",
      type: "supports",
      explanation:
        "The principle that justice extends to all parties affected by present decisions directly justifies the institutional representation of future generations demanded by J12.",
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
