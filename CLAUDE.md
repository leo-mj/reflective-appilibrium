# Reflective Appilibrium

Wide reflective equilibrium (RE) tool. Research project on LLM-assisted RE.
Three phases: Phase 1 = Claude Skill (working);
Phase 2 = React SPA + FastAPI backend for LLM access (in progress);
Phase 3 = Integration of rethon (computational RE).

## Layout

- `app/` — the React SPA (Vite). See `app/CLAUDE.md`.
- `backend/` — FastAPI: LLM proxy plus the Python RE computation layer. See `backend/CLAUDE.md`.
- `skill/` — Phase 1 Claude Skill, and the prose reference the domain model below follows.
- `plans/`, `sessions/` — design notes and captured runs.

One codebase ships two ways, selected by `VITE_APP_ENV` (`app/src/config.js`):
`demo` is the public static build with no backend and no LLM; `dev` and `backend`
turn on the backend, the LLM features and the BYOK settings modal. State files are
interchangeable between them — export/import is the handoff.

Frontend tests are Vitest (`npm test` in `app/`) plus Playwright (`npm run test:e2e`,
see `app/e2e/README.md`); the backend is pytest from the repo root.

## RE domain model

### Element types

- **Judgments (J)** — Moral verdicts, any generality. Circles.
- **Principles (P)** — General moral rules. Rounded rectangles.
- **Background Theories (T)** — Meta-ethical commitments. Diamonds. Deferred to Round 5+.

Every element carries a `confidence` in [0, 1] and a `status`: `active`, `revised`,
`withdrawn`, `rejected`, or `possible` (an option offered but not yet affirmed —
questionnaire mode uses this). Only `possible` elements are barred from new
arguments; withdrawn and rejected ones stay eligible, since a fresh argument is how
an element earns a second look.

### Relation types

Two families, both directional, and a pair of elements may carry several at once.

**Dialectical** — reasons for and against, offered by the two-endpoint pickers.

- **Supports** — A provides positive reason for B
- **Conflicts** — A and B are incompatible
- **Undermines** — A weakens B without flat contradiction
- **Depends** — A presupposes B

**Inferential** — formal argument steps, and what the rethon simulation reads.

- **Entails** — A entails B
- **Precludes** — A entails the negation of B
- **Jointly entails** — A together with the argument's other premises entails B
- **Jointly precludes** — likewise, for the negation of B

The four inferential types are `ARGUMENT_RELATION_TYPES` in `utils/stateUtils.js`;
prefer that set over listing them by hand. Each such relation carries an
`argumentId`, and the joint pair uses it to tie the premises of one argument
together: the graph draws the group as converging lines into a junction dot, and
withdrawing, reinstating or deleting any one of them applies to the whole argument.

Which pairs of element types may legally hold which relation is the full matrix in
`skill/re-relations-reference.md`.

### Groups

A **group** is a set of elements the user has bracketed together to tidy the
graph — `state.groups`, `app/src/utils/groupUtils.js`. It is a view device and
nothing more: grouping does not advance the round, does not appear in the log,
and does not enter the coherence analysis. Don't confuse it with the *coherent
cluster* of `utils/clusterUtils.js`, which is computed from the relations rather
than chosen, and lives on its own tab.

Collapsed — which is how a new one arrives, grouping being asked for to tidy the
canvas — a group is drawn as one node carrying its name, and its members are not
drawn at all. Relations between two members go with them; **every relation
crossing the group's boundary is kept**, re-pointed at the group node, and stays
a separate edge. An element belongs to at most one group.

Groups are listed in the text panel too, where a collapsed one's members are
still spelled out, and both name and membership are editable there and from the
graph.

`state.groups` is absent from every state written before the feature existed —
read it through `groupsOf(state)`, never directly.

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
  ?groups: [{ id, label, members: [elementId], collapsed }],
  log: [{ round, findings, options, decision, changes }]
}
```

`origin` records who introduced an item: `"user"`, a model name, or a model name
plus `"+user"` when the user edited an LLM suggestion. `utils/stateUtils.js` has the
helpers (`llmOrigin`, `withUserEdit`) — don't parse it by hand.

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
