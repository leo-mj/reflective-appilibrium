# Assistive Equilibrium

Wide reflective equilibrium (RE) tool. Research project on LLM-assisted RE. Two phases: Phase 1 = Claude Skill (working); Phase 2 = React SPA + FastAPI backend (in progress).

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

Directional; a pair can have multiple. Full matrix in `skill/re-relations-reference.md`.

### State schema

```javascript
{
  topic: String, phase: Number, round: Number,
  elements: [{ id, type, status, confidence, origin, text, addedRound, ?previousText, ?revisedRound, ?reason, ?withdrawnRound }],
  relations: [{ from, to, type, explanation, addedRound }],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [{ round, findings, options, decision, changes }]
}
```
