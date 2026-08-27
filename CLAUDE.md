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
- **Background Theories (T)** — Meta-ethical commitments. Diamonds. Suggested in
  every round, as the workflow's third step.

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

### Background theories

Suggested by `components/workflows/TheorySuggestTab.jsx`, backed by
`POST /api/theories/suggest`. Two things decide what gets proposed, and both are
in the prompt rather than in a field the model fills in:

1. **The strength of the reasons for the theory** — reasons that do not run
   through this user's moral position. That is the independence constraint, and
   it is what makes RE *wide*. Standing in the literature is a defeasible sign
   such reasons exist; it is never a substitute for one.
2. **Relevance** — to the topic, and to these judgments and principles. Enforced,
   not merely asked for: a suggestion bearing on no active element is dropped.

Two criteria it deliberately is **not**, both of which look plausible:

- **Not presupposition.** "Surface what the position already presupposes" is
  orthogonal to plausibility — it would rank a fringe commitment the user's
  principles happen to require above a well-supported theory they do not, and a
  theory chosen that way borrows all its credibility from the position it is
  meant to support. That is narrow RE with a third node shape. `depends` remains
  a legal *relation*; it is just never a reason to propose anything.
- **Not balance.** The prompt must not require theories on both sides: a quota
  for opposition platforms fringe positions for opposing rather than for being
  well-supported. The instruction is *non-suppression* — do not filter by whether
  a theory agrees — which corrects the real bias (a model suppressing what
  disagrees with the user) without manufacturing controversy.

A suggestion is a theory and the works it is developed in, and **says nothing
about how it relates to the elements already on the board**. Which relations hold
is the Relations tab's business; annotating them here would duplicate that tab
and put the model's reading of a connection ahead of the user's. The elements
reach the prompt as context for choosing well, and the prompt says explicitly not
to comment on them — a model handed a list of principles otherwise volunteers how
each theory bears on them.

One consequence worth knowing: relevance was the criterion the router could
enforce, by dropping a theory that bore on nothing. It is now a prompt
instruction like the rest, so nothing downstream checks it.

**Citations.** `sources` on the element holds bibliographic *fields*, and
`app/src/utils/citation.js` does the APA 7 formatting — asking a model for
formatted prose would make quality depend on its typography rather than on what
it knows. They are optional by design: requiring one per suggestion is how
fabricated citations are produced, and the prompt says so explicitly.

`services/crossref.py` checks each one, and its three states must stay distinct:
`matched` (confirmed, and carrying Crossref's DOI), `not_found` (checked,
nothing confirmed), `unchecked` (could not look). **`not_found` is not evidence
of fabrication** — Crossref does not index every philosophy monograph — and a
**`matched` establishes only that the work exists**, never that it says what the
element claims. Both caveats are load-bearing in the UI wording. The verdict is
response-only; the DOI persists, so a stored reference carrying one is a
reference that verified, and nothing goes stale.

`sources` is absent from every element written before the feature existed, and
from anything added by hand.

### Process reviews

A **review** is an LLM reading of the process as a whole — `state.reviews`,
`components/workflows/ProcessReviewTab.jsx`, backed by `POST /api/review/analyze`.
Five parts, 500 words: a one-sentence `headline`, then `arc` (how the position
moved), `surprises`, `missed` (coherence available and not taken), and `method`
(how the process was *conducted* — adding versus revising, whether suggestions
were reworded before acceptance, read off `origin` and `confidence`).

Reviews **accumulate**, oldest first. A later run is given the earlier ones —
the newest in full, the rest as round plus headline, which is what keeps the
prompt bounded — and is asked to say what has moved since and whether an
opportunity an earlier review named was taken. That series is the feature; a
single end-of-run summary cannot comment on the process's own development.

Like grouping and for a sharper reason, accepting or discarding a review
**does not advance the round and does not appear in the log**: a review is a
reading *of* the process, so recording it as a change would alter the record it
describes — and would reach the next review's timeline as though it were a move
in the argument. That is also what makes running one mid-process safe.

It is **not a phase of the iteration** — it is absent from
`WORKFLOW_NEXT_PHASE`, which holds the five that loop — but the workflow does
**stop here every fifth iteration** (`REVIEW_EVERY`, `nextWorkflowPhase` in
`utils/workflowUtils.js`), which is where the accumulating series comes from
under a reader who only ever presses on. That is a stop *between* iterations,
and the paragraph above is why it can be: passing through advances no round and
writes no log entry, so a review still cannot alter the record it describes.

`state.reviews` is absent from every state written before the feature existed —
read it through `reviewsOf(state)`, never directly.

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
  elements: [{ id, type, status, confidence, origin, text, addedRound, ?history, ?previousText, ?revisedRound, ?reason, ?rejectedRound, ?questionnaireIndex, ?sources }],
  relations: [{ from, to, type, explanation, addedRound, ?origin, ?status, ?history, ?argumentId, ?revisedRound }],
  coherence: { tensions: [], orphans: [], clusters: [] },
  ?groups: [{ id, label, members: [elementId], collapsed }],
  ?reviews: [{ id, round, headline, arc, surprises, missed, method, model, origin }],
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
