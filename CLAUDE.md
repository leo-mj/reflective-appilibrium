# Reflective Appilibrium

Wide reflective equilibrium (RE) tool. Research project on LLM-assisted RE.
Three phases: Phase 1 = Claude Skill (working);
Phase 2 = React SPA + FastAPI backend for LLM access (in progress);
Phase 3 = Integration of rethon (computational RE).

## Layout

- `app/` — the React SPA (Vite). See `app/CLAUDE.md`.
- `backend/` — FastAPI: LLM proxy plus the Python RE computation layer. See `backend/CLAUDE.md`.
- `skill/` — Phase 1 Claude Skill, and the prose reference the domain model below follows.
- `plans/` — design notes.

One codebase ships two ways, selected by `VITE_APP_ENV` (`app/src/config.js`):
`demo` is the public static build with no backend and no LLM; `dev` and `backend`
turn on the backend, the LLM features and the BYOK settings modal. State files are
interchangeable between them — export/import is the handoff.

**The two are published as separate sites**, and which host serves each is a
deployment decision the code does not know about. The demo carries no key and
makes no requests; the `backend` build holds a visitor's API key in the tab, so
it gets an address of its own rather than sharing one with unrelated pages. A
build is aimed by three values — `VITE_APP_ENV`, `VITE_BACKEND_URL` and
`VITE_BASE_PATH` — plus `CORS_ORIGINS` on the server; `app/src/backendUrl.js`
defines what the backend URL may say, including `/` for the case where one host
serves the page and routes `/api` to the backend. Don't write a host's name into
the app: the workflows hold the examples, and they read repository variables.

**Nothing is stored on a server, in either build.** The working state is
autosaved to the browser (`localStorage`, offered back as "Continue where you
left off") and Markdown export is the only way out of it. There is one draft
slot, so Start on the landing page asks before a new process replaces a draft
on offer (`ReplaceDraftDialog` in `HomePage.jsx`), offering its export first.

**Export asks what to write.** ☰ → Export opens `ExportModal`, which offers the
sections of `EXPORT_SECTIONS` in `utils/exportMarkdown.js` — elements,
relations, graph, clusters, the log, an Argdown rendering and so on — leaving
out any with nothing to say, and remembers the choice in the browser. **Full
history** is the `re-state` block, the only part Import and Merge read: a file
without it is a report, not a way back in, and the dialog says so when it is
unticked. The defaults are the export as it was before the choice existed,
Argdown off. The same dialog's **Download .argdown** writes the Argdown map
alone (`downloadArgdown`), ignoring the ticks: Argdown's tools open that file
and not a Markdown one, and Import reads it back as an argument map. There was a
`/api/sessions` router writing RE states to a directory on disk; it was removed
rather than switched off, since a gate is one setting away from holding
strangers' moral reasoning on a shared machine. See `backend/CLAUDE.md` for what
pins that.

Frontend tests are Vitest (`npm test` in `app/`) plus Playwright (`npm run test:e2e`,
see `app/e2e/README.md`); the backend is pytest from the repo root.

## RE domain model

### Element types

- **Judgments (J)** — Moral verdicts, any generality. Circles.
- **Principles (P)** — General moral rules. Rounded rectangles.
- **Background Theories (T)** — Meta-ethical commitments and other background
  knowledge, empirical claims included. Diamonds. Suggested in every round, as
  the workflow's third step.

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

There was a fourth, **depends** (A presupposes B), and it was retired: it joined
two relations pointing opposite ways — B grounds A, which is *B supports A*, and
A cannot be true without B, which is *A entails B* — so an edge carrying it did
not say which way the reasons ran, and the coherence analysis read it as
neither. A state written before then still loads: `validateState` in
`utils/importMarkdown.js`, which every file, merge and autosaved draft passes
through, rewrites each one as the reversed `supports`, the weaker of the two
and the one in the same family. One that lands on a `supports` already held is
dropped. **The migration is silent**: no log entry, no note on the edge, its
explanation untouched — keep it that way. Nothing offers, suggests or writes
the type any more, and the backend refuses it.

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

**All four reach the rethon simulation, withdrawn ones included**
(`rethon_arguments` in `backend/services/rethon_caps.py`). Single-premise
arguments used to be left out, which simulated a process argued one premise at
a time as though it had none. Withdrawn arguments stay deliberately: an
argument still holds when the reader sets it aside, and keeping it is what
lets the simulation find that re-including a withdrawn element would make the
position more coherent. Only links a revision *replaced* are left out — from
the step of the revision on, in History's per-step scores too
(`relations_at_step` in `rethon_scoring.py`). Those scores take each step as it
stood: every element with the status its history gives it at that step
(`elements_at_step`, folding events as `foldHistory` does), withdrawn ones kept
in the pool uncommitted, as the full simulation keeps them.

**The simulation's theory is made of principles and background theories
only** (`backend/services/rethon_theory.py`) — unnegated, of any status. That
is what the scoring already takes as the theory, so account and systematicity
mean one thing on the Simulate tab, in History and on the text cards. rethon's
standard model lets any consistent position be the theory, a judgment
included; this departs from it deliberately, since an element's type is the
user saying which elements are general rules. A process with no principle or
theory is refused, there being no theory to find.

**And it starts from the theory the user holds** — the active and revised
principles and theories, the scoring's theory — where rethon would choose a
first theory for the commitments (near the empty position, locally). The
commitments already start from the user's current statuses, so a fresh theory
was the one part that restarted the process instead of continuing it; and a
local search started near the empty position can settle on less than the user
holds (`test_rethon_theory.py` has such a case). **A held theory the arguments
make inconsistent starts from its largest consistent part**, principles taken
most confident first — most positions worth simulating have open conflicts,
and falling back to rethon's start instead began the demo from one principle
and withdrew most of it. Only a process holding no principle or theory falls
back to rethon's start. Whether seeded and unseeded runs reach different
equilibria is a result worth recording, not a reason to go back.

**Ties are broken reproducibly**: rethon picks at random among equally good
candidates, so the same request withdrew different elements on each press.
The restricted processes pick with a generator seeded from their own inputs.

**A judgment premise never helps the theory account for anything**, since
rethon's account asks what the theory alone implies and a judgment cannot be in
it: P + J → J' leaves J' unaccounted for. An empirical premise is a background
theory — wide RE draws on other domains of inquiry — and typing it so is what
lets such an argument count. The Arguments tab's prompt says so outright
(`build_prompt` in `backend/services/arguments.py`): every empirical premise it
adds is a theory. The demo's T3 was J14 until that showed. `make_re(…, None)` is the standard
model, unrestricted and unseeded, for comparison with published rethon runs;
no route uses it.

#### Revising an argument

Revise on an argument opens `ReviseArgumentModal`, which works on its premises:
each can be **swapped** for another element or a new statement, **reworded**
in place — which revises that element itself, everywhere it appears — or
**taken out**, and premises can be added. The conclusion can be swapped or
reworded the same way, but never taken out. Entails/Precludes and the
explanation are there too. It is all one step, one log entry and one undo
(`handleArgumentRevise` in `useRelationActions`).

- **The same premises and conclusion** — only type, explanation or wording
  changed — revise the argument in place, as any relation is revised.
- **Different premises, or another conclusion, replace the argument.** Its links are withdrawn at that
  step and marked `supersededBy` the new argument's id; the new one carries the
  new premises. So everything that groups premises by `argumentId` is
  untouched, and History shows the argument as it was before the step and as
  revised after (`isSupersededAt`, `stateAtRound`). Editing the links in place
  would have shown today's premises at every step.
- **A superseded link is the record, not the position**: `withoutSuperseded`
  drops it from what the graph, text panel and clusters see (`presentState` in
  `REState`), there is nothing to reinstate, and the Argdown export leaves it
  out. The Markdown export's relation list and the `re-state` block keep it,
  and the backend model declares the field, since it refuses unknown ones.

A joint argument's card carries one Revise and one Withdraw, in a header row:
both act on the whole argument.

Which pairs of element types may legally hold which relation is the full matrix in
`skill/re-relations-reference.md`.

### Steps and rounds

Two units, decided in issue #36 (its third alternative):

- **A step is one change** — an element or relation added, revised, withdrawn,
  reinstated, rejected, a merge. `state.round` counts steps, and so does every
  `addedRound`, `revisedRound` and history event `round`: **the fields keep their
  names** because every saved file uses them, and no file needs migrating. One
  step per change is what makes playback exact and undo one change at a time.
- **A round is an iteration of the method**: a run of consecutive steps.
  `state.roundEnds` lists the last step of each closed round, ascending; the
  steps after the last one are the open round, numbered one past them. A round
  closes **as a workflow iteration completes** (`advanceWorkflow` in `REState`)
  or **by hand** — Close round beside the wide header's heading, ☰ on a phone —
  and only once something has changed in it (`canCloseRound`). Closing one is an
  undo step, but takes no step and writes no log entry: it records how the
  changes are grouped, not a change.

The reader sees both: the header reads "Round 3 · Step 23"; cards, the log, the
history events and the export are stamped in steps; the export's log is grouped
under round headings; History's slider moves by step or, switched to Rounds,
stops at the end of each round, and the Z-score chart follows it. Read the rounds
through the helpers in `utils/stateUtils.js` — `roundEndsOf`, `roundOfStep`,
`currentRound`, `roundStops` — since `roundEnds` is absent from every state
written before it existed, which then reads as one open round. The backend model
carries it (`round_ends`), and the review prompt gives the model its timeline by
round and step and asks for steps to be cited as steps.

The sample process is eight rounds of many steps, numbered as the app would
have recorded them: every change a step, an argument's premises sharing one, and
within a round elements before relations before revisions and withdrawals. Its
log has one entry per step, as the app writes them, generated from its own
elements and relations (`sample-data/sampleLog.js`, in the handlers' wording),
so it cannot drift from the process it records; its review speaks of rounds.
`rounds.test.js` holds it to that shape. It used to keep one narrative entry
per round, which left History's log box on the demo behind the step playing. Cards and node tooltips say
when something was added as "Round 2 · Step 14" (`stepLabel`). A merge keeps the current process's rounds and drops
the incoming one's, whose steps are not this process's.

### Groups

A **group** is a set of elements the user has bracketed together to tidy the
graph — `state.groups`, `app/src/utils/groupUtils.js`. It is a view device and
nothing more: grouping takes no step, does not appear in the log,
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

### Pinned positions

Dragging a node on the Graph tab (mouse only; a finger pans) pins it where it
is dropped — `state.pins`, `{ J1: { x, y } }`, `utils/pinUtils.js`, read through
`pinsOf(state)`. Like a group it is a view device: no step, no log entry, not in
the coherence analysis. Unlike a group it is **not an undo step** either — the
`pins` action in `useREActions` changes the present without recording it, and
undo and redo carry the present's pins across (`carryPins`), so undoing an edit
does not undo the drags made since. It is on the state so that the export's
`re-state` block, the autosave and Import carry it.

- **Offsets from the layout's centre**, not canvas coordinates, since the centre
  follows the reader's window.
- **Merge keeps only the current process's pins**: the incoming file's were
  positions on another canvas.
- **A group that closes drops its members' pins** (`withGroups` in
  `useGroupActions`), since collapsed members have to gather on the disc;
  dragging the closed group pins them again, together.
- Argdown has no place for coordinates, so they stay out of it.
- **A drag moves only what is held**: grabbing a node brings the layout to rest
  (`sim.stop()` in `grab`) rather than warming it as D3's own drag does. Left
  alone is not enough — a layout looks still seconds before it stops, and
  carrying a node through one still running shoves every neighbour it passes,
  which is what `e2e/dragging.spec.js` first caught. In the statement view
  cards are not pushed apart until the
  card is let go (`hold` in `nextStatementLayout`). What is held is the node, a
  collapsed group's members, or the whole ctrl+click selection when the node
  pressed is in it.
- **☰ → Content → Reset layout** clears every pin, offered only while one
  exists. It is the one pin change that *is* an undo step — `carryPins` leaves a
  step alone when the pins are all it changed — since it discards every
  placement at once.

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
  meant to support. That is narrow RE with a third node shape. A theory the
  position does rest on can still be tied to it by a `supports` edge; that is
  just never a reason to propose one.
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
the newest in full, the rest as step plus headline, which is what keeps the
prompt bounded — and is asked to say what has moved since and whether an
opportunity an earlier review named was taken. That series is the feature; a
single end-of-run summary cannot comment on the process's own development.

Like grouping and for a sharper reason, accepting or discarding a review
**takes no step and does not appear in the log**: a review is a
reading *of* the process, so recording it as a change would alter the record it
describes — and would reach the next review's timeline as though it were a move
in the argument. That is also what makes running one mid-process safe.

It is **not a phase of the iteration** — it is absent from
`WORKFLOW_NEXT_PHASE`, which holds the five that loop — but the workflow does
**stop here every fifth iteration** (`REVIEW_EVERY`, `nextWorkflowPhase` in
`utils/workflowUtils.js`), which is where the accumulating series comes from
under a reader who only ever presses on. That is a stop *between* iterations,
and the paragraph above is why it can be: passing through takes no step and
writes no log entry, so a review still cannot alter the record it describes.

`state.reviews` is absent from every state written before the feature existed —
read it through `reviewsOf(state)`, never directly.

### Merging processes

**Merge** (☰ → Session) reads a second exported file into the open process —
`utils/mergeStates.js`. Unlike Import it replaces nothing and is one undo step.

It is two steps, `handlePrepareMerge` and `handleConfirmMerge` in `useREActions`,
with `MergeModal` between them: before anything changes, the reader sees how much
the merge adds and which incoming elements are identical to ones here.
`previewMerge` runs the merge itself to get these, so the preview cannot describe
a different merge from the one performed.

The modal deliberately does **not** report new conflicts. The merge only copies
relations, so a tension it could find is one the other process had already drawn
— never a disagreement between the two that nobody drew — and an empty list would
read as reassurance it cannot give.

The merge is **one step** of the current process: every incoming item arrives in
it, as it stands at the end of its own process — withdrawn and rejected items as
such, a revised one as `active` with the wording it reached. The incoming history,
log and reviews are not replayed, since none of it happened *here*; playback would
otherwise show elements before they were brought in. The single log entry the
merge writes is what survives of it, and it spells out the renumbering (`J1 → J8`)
because the incoming log's prose names ids that no longer exist.

Elements of the same type and wording (whitespace aside) are **fused**: the current
copy is kept untouched, incoming relations are re-pointed at it, and each pair is
named in the log. Relations and arguments that fusing turns into duplicates or
loops are dropped. Incoming groups are renumbered, and lose any member the current
process has already grouped. Questionnaire sessions cannot be merged on either side.

**Which process an element came from** stays visible afterwards: `state.processes`
(`[{ id: "A", label, members, round }]`, lettered in merge order, labelled by
topic, stamped with the merge's step) — read it through `processesOf(state)`,
which leaves out processes merged after the state's own step, so playback and a
`stateAtRound` projection show no letters before the merge that made them. Every
node wears its letter (`"A+B"` when fused) on the Graph, History and Cluster tabs
and in the exported SVGs; the legend and the export's "Merged Processes" section
key the letters, and text cards and the export's element lines name the process.
Letters rather than colours, since node colour already carries type and
confidence. **Process tags** in ☰ → Content hides them all at once, and is offered
only once a merge has happened. It works by handing the graphs and text panel a
view of the state without `processes` (`viewState` in `REState`) — which is why
every surface must read the record through `processesOf` — while edits, the
autosave and the export keep the real state. The export always carries the tags:
like the palette, it does not follow a reader's view settings. It lives on the state and **not on the elements**, because the
backend's element model forbids unknown fields; the backend drops it on a server
save, as it does groups, while export/import keeps it. An incoming process that
was itself a merge keeps its own processes apart under letters of their own.
Elements added after a merge carry no letter.

**Merging elements.** A process merge fuses only identical wording. The **Merge**
assist tab (`components/workflows/ElementMergeTab.jsx`, offered only once
`state.processes` exists, never a workflow phase, never fetched on arrival) asks a
model for pairs — one element from each of two processes, same type, no process in
common — that make the *same claim* in different words. `POST /api/merge/pairs`
(`backend/routers/merge.py`) holds the prompt and drops anything else the model
returns; a model's say-so never puts a pair on screen. `state.processes` is not in
the backend's state model, so the client sends it alongside the elements, and the
tab re-checks each pair with `isMergeablePair` as the state moves on under it.
Accepting one (`mergeElementPair` in `utils/elementMerge.js`) is one step: the
reader picks which wording stays, may reword it (recorded as a revision) and sets
its confidence; the other element is **removed outright**, its relations
re-pointed at the kept one — loops and duplicates dropped, a joint argument that
loses a premise retyped — and the kept element joins both processes. Being a
removal, playback shows the re-pointed relations on the kept element in earlier
rounds too, and older log entries still name the removed id; that was chosen over
withdrawing it. Dismissing records nothing.

**The samples.** `sample-data/sample-process-climate-duties.md` is a second
process in export format, written to be merged into the one the app opens with:
nothing is worded identically, so nothing fuses automatically and every pair is
the reader's to decide. ☰ → Session → **Merge (demo)** brings it in through the
same preview modal a picked file goes through, and is offered on the sample
process only (`isSample`) — in someone's own process a demo's judgments are not a
merge anyone asked for. It is `import(…?raw)`ed on the press, so the fixture is a
chunk of its own rather than part of the main bundle; that is also why it lives
in `sample-data/` rather than `public/`, one copy that both the button and the
test read. `sample-data/sample-merge-pairs.js` holds the five pairs
the tab then offers without a model, **keyed by wording rather than by id** —
which ids the second process lands on depends on the first — and falling back to
word overlap (`samplePairs`) for any other process. All three drift apart
silently, so `sample-merge-pairs.test.js` reads the file as the app does, merges
it and checks the pairs still resolve.

### Argdown import

☰ → Import and ☰ → Merge also take an [Argdown](https://argdown.org/syntax/) file
(`.argdown`, `.ad`) — `utils/importArgdown.js`, the inverse of
`utils/exportArgdown.js`, so an argument map written elsewhere (a paper's
reconstruction) becomes a graph. Parsing is `@argdown/core`'s own parser, loaded
on the press as a chunk of its own; `package.json` overrides `lodash-es` because
the chevrotain it pins fails `npm audit`.

Statements become elements, typed by `#judgment` / `#principle` / `#theory` and
**a judgment when untagged**; each inference step of a premise-conclusion
structure becomes one argument (`entails` / `jointly_entails`, premises being
the statements since the previous conclusion unless `-- {uses: [1, 3]} --` says
otherwise).

Statement relations follow **Argdown's interpretation mode**: loose (the
default) is the dialectical family, strict (`model: {mode: strict}` in the front
matter, which the parser reads itself) the inferential one.

| Argdown         | Loose mode  | Strict mode |
|-----------------|-------------|-------------|
| `+>` support    | supports    | entails     |
| `->` attack     | conflicts   | precludes   |
| `><` contradict | precludes   | precludes   |

Strict `->` is contrariety, not both true, which is "A entails not-B". `><` is
logical in both modes and keeps only that half; its "not both false" has no
counterpart, and the log entry says so whenever one is imported. Each `entails`
or `precludes` read from a statement relation is a one-premise argument of its
own, skipped if a premise-conclusion structure already holds it. The exception
is the exporter's negation: a `[not X]` tied to `[X]` by `><` turns a conclusion
into `precludes` and is neither an element nor a relation.

Undercuts and relations aimed at a whole reconstructed argument have no
counterpart and are left out — **counted in the import's log entry**, which also
names the mode it read and which title became which id, since titles do not
survive. A title that is already an id of its type is kept, which is what makes
an exported file round-trip.

**Groups are headings**, which is also how Argdown's own maps draw a group.
Each element joins the nearest heading above its definition; `{isGroup: false}`
on a heading opts it out, and `{isClosed: true}` makes the group collapsed.
Groups here are flat, so a nested heading becomes a group of its own, and a
heading over one statement is none — both counted in the log. The export keeps
groups visibly apart from the type sections: every group is a `##` heading over
its members, of any type, under one `# Groups` heading, and the rest go under
`# Judgments` and the other type headings. `# Groups` and the type headings
carry `{isGroup: false}`, so neither Argdown's maps nor the import read them as
groups.

The export (`utils/exportArgdown.js`) reaches the reader as the Argdown section
of the Markdown export, a fenced `argdown` block. It writes loose mode: `supports` and
`conflicts` as `+>` and `->`, arguments as premise-conclusion structures.
**`undermines` does not survive the round trip**: having no symbol of its own,
it is written as `->` and comes back as `conflicts`. The trailing comment
naming the original type is for a human reader; the parser drops comments.

### State schema

```javascript
{
  topic: String, phase: Number, round: Number,   // `round` is the step
  ?roundEnds: [Number],             // last step of each closed round
  ?model: "questionnaire",          // present only in questionnaire mode
  ?questionnaireSpec: {             // present only in questionnaire mode
    name: String,
    card: { title, description, buttonLabel },
    suggestions: [{ question, judgments: [{ index, id, confidence, answer, text }] }],
    participantArguments: Array,    // index arrays, last entry = conclusion
    furtherArguments: Array,
  },
  elements: [{ id, type, status, confidence, origin, text, addedRound, ?history, ?previousText, ?revisedRound, ?reason, ?rejectedRound, ?questionnaireIndex, ?sources }],
  relations: [{ from, to, type, explanation, addedRound, ?origin, ?status, ?history, ?argumentId, ?revisedRound, ?supersededBy }],
  coherence: { tensions: [], orphans: [], clusters: [] },
  ?groups: [{ id, label, members: [elementId], collapsed }],
  ?pins: { [elementId]: { x, y } },  // offsets from the layout's centre
  ?reviews: [{ id, round, headline, arc, surprises, missed, method, model, origin }],
  log: [{ round, findings, options, decision, changes }]
}
```

`origin` records who introduced an item: `"user"`, a model name, or a model name
plus `"+user"` when the user edited an LLM suggestion. `utils/stateUtils.js` has the
helpers (`llmOrigin`, `withUserEdit`) — don't parse it by hand.

### Item history

`status` on an element or relation is its state *now*. The step-by-step record
is `history`: an ordered list of `{ round, type, ?reason, ?previousText }` events,
where `type` is `withdrawn`, `reinstated`, `revised`, or `rejected`. An item may
be withdrawn and reinstated any number of times.

Read it through `utils/stateUtils.js` rather than directly — `historyOf` also
migrates the older single-round fields (`withdrawnRound`, `revisedRound`,
`rejectedRound`) that saved states still use. `isWithdrawnAt`, `textAtRound` and
`asOfRound` answer what was true at a given round; `asOfRound` is what history
playback uses to project an item back.
