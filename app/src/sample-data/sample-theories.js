// Sample background theory suggestions for the TheorySuggestTab.
// Topic: obligations to future generations (matches sample-state.js).
// Used automatically in PROD, or in DEV when the "Use sample data" toggle is on.
//
// Stored in the tab's *final* shape, verification states included, because
// `makeLLMClient` serves `dummyData` without running `transformResponse` — and
// because the demo build has no backend, so nothing would ever check these.
// Between the three suggestions they cover every state the card can be in:
//
//   - a `matched` reference, carrying the DOI Crossref returned;
//   - a `not_found` one, which is emphatically not a claim of fabrication —
//     Crossref's coverage of philosophy monographs is patchy;
//   - a suggestion with no references at all, which is a permitted and often
//     preferable answer rather than a failure to render.
//
// Between them the three also show the range the tab is for: two that support
// the sample position and one that tells against it. Nothing here says so — how
// a theory relates to the elements is the Relations tab's business — but a demo
// whose theories all flattered the user would misrepresent the feature.

const sampleTheories = {
  model: "claude-fable-5",
  suggestions: [
    {
      text: "A person can be harmed by an act only if that act makes them worse off than they would otherwise have been, and no one is made worse off by an act without which they would never have existed.",
      confidence: 0.67,
      sources: [
        {
          type: "book",
          authors: ["Parfit, D."],
          year: "1984",
          title: "Reasons and persons",
          container: "",
          editors: [],
          publisher: "Oxford University Press",
          volume: "",
          issue: "",
          pages: "",
          doi: "10.1093/019824908x.001.0001",
          verification: "matched",
        },
      ],
    },
    {
      text: "Moral status attaches to the capacity for wellbeing rather than to presently existing in the world, so that whether a being's interests count does not depend on when they exist.",
      confidence: 0.67,
      sources: [
        {
          type: "chapter",
          authors: ["Roberts, M. A."],
          year: "2021",
          title: "The nonidentity problem",
          container: "The Stanford encyclopedia of philosophy",
          editors: ["E. N. Zalta"],
          publisher: "Metaphysics Research Lab, Stanford University",
          volume: "",
          issue: "",
          pages: "",
          doi: "",
          verification: "not_found",
        },
      ],
    },
    {
      text: "Persons persist through time in virtue of psychological continuity rather than any further fact, so that the boundary between one's own future and a stranger's is a matter of degree.",
      confidence: 0.67,
      sources: [],
    },
  ],
};

export default sampleTheories;
