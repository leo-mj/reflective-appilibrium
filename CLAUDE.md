# Reflective Appilibrium

Wide reflective equilibrium (RE) tool. Research project on LLM-assisted RE.
Three phases: Phase 1 = Claude Skill (working);
Phase 2 = React SPA + FastAPI backend for LLM access (in progress);
Phase 3 = Integration of rethon (computational RE).

## RE domain model

### Element types

- **Judgments (J)** — Moral verdicts, any generality. Circles.
- **Principles (P)** — General moral rules. Rounded rectangles.
- **Background Theories (T)** — Meta-ethical commitments. Diamonds. Deferred to Round 5+.

### Relation types

- **Supports** — A provides positive reason for B
- **Conflicts** — A and B are incompatible
- **Undermines** — A weakens B without flat contradiction
- **Depends** — A presupposes B
- **Jointly Entails** - A (together with some other element) entails B

Directional; a pair can have multiple. Full matrix in `skill/re-relations-reference.md`.

### State schema

```javascript
{
  topic: String, phase: Number, round: Number,
  ?model: "questionnaire",          // present only in questionnaire mode
  ?questionnaireSpec: {             // present only in questionnaire mode
    name: String,
    card: { title, description, buttonLabel },
    suggestions: [{ question, judgments: [{ index, id, confidence, answer, text }] }],
    participantArguments: Array,    // index arrays, last entry = conclusion
    furtherArguments: Array,
  },
  elements: [{ id, type, status, confidence, origin, text, addedRound, ?history, ?previousText, ?revisedRound, ?reason, ?rejectedRound, ?questionnaireIndex }],
  relations: [{ from, to, type, explanation, addedRound, ?origin, ?status, ?history, ?argumentId, ?revisedRound }],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [{ round, findings, options, decision, changes }]
}
```

### Item history

`status` on an element or relation is its state *now*. The round-by-round record
is `history`: an ordered list of `{ round, type, ?reason, ?previousText }` events,
where `type` is `withdrawn`, `reinstated`, `revised`, or `rejected`. An item may
be withdrawn and reinstated any number of times.

Read it through `utils/stateUtils.js` rather than directly — `historyOf` also
migrates the older single-round fields (`withdrawnRound`, `revisedRound`,
`rejectedRound`) that saved states still use. `isWithdrawnAt`, `textAtRound` and
`asOfRound` answer what was true at a given round; `asOfRound` is what history
playback uses to project an item back.
