// Sample principle suggestions for the PrincipleSuggestTab.
// Topic: obligations to future generations (matches sample-state.js).
// Used automatically in PROD, or in DEV when the "Use sample data" toggle is on.
// Deliberately non-overlapping with P1–P6 already in the sample state.

const samplePrinciples = {
  model: "claude-fable-5",
  suggestions: [
    {
      text: "Political institutions that make long-term decisions must include formal mechanisms — such as ombudspersons or reserved deliberative bodies — that give weight to the interests of future generations.",
      confidence: 0.67,
      covers: ["J2", "J12"],
      explanation:
        "Fills the gap flagged in the coherence analysis: J12 currently lacks its own principled grounding. An institutional-design principle grounds the representation mechanisms J12 demands and strengthens the long-horizon policy duty in J2.",
    },
    {
      text: "Each generation owes obligations directly to its immediate successors, whose own obligations to their successors transmit duties down the generations (chain of obligation).",
      confidence: 0.33,
      covers: ["J1", "J3", "J7"],
      explanation:
        "Grounds duties to distant generations through overlapping generations, without invoking contested direct obligations to remote future people. It also explains the parental asymmetry in J7 — offering an alternative route to P2 and P5 that the user may wish to weigh against them.",
    },
    {
      text: "When outcomes for future people are uncertain, agents must give more weight to avoiding severe and irreversible harms — such as extinction or ecosystem collapse — than to securing comparable benefits (intergenerational precaution).",
      confidence: 0.67,
      covers: ["J1", "J8"],
      explanation:
        "Grounds the radioactive-waste and extinction verdicts in an asymmetry between irreversible harms and foregone benefits, a third route alongside the threshold reasoning of P1 and the probabilistic reasoning of P2 — and one that coheres with the uncertainty-sensitivity of P3.",
    },
  ],
};

export default samplePrinciples;
