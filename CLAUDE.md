# Assistive Equilibrium

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
  elements: [{ id, type, status, confidence, origin, text, addedRound, ?previousText, ?revisedRound, ?reason, ?withdrawnRound, ?questionnaireIndex }],
  relations: [{ from, to, type, explanation, addedRound, ?origin }],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [{ round, findings, options, decision, changes }]
}
```
