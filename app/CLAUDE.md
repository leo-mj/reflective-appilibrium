# app/ — Phase 2 Frontend

React SPA (Vite). `src/config.js` derives every feature flag from one build-time
`VITE_APP_ENV` (`dev` | `demo` | `backend`) — `LLM_ENABLED` and `BYOK_ENABLED` both
follow `BACKEND_ENABLED`.

Two more build-time values decide where a build is *served* and where it *calls*,
and both have one home each: `VITE_BASE_PATH` through `vite-plugins/basePath.js`
(unset, the demo keeps the repo prefix GitHub Pages needs, and every other build is served from the root), and `VITE_BACKEND_URL` through
`src/backendUrl.js`, exported as `BACKEND_URL` from `config.js` — every client
imports that rather than reading the variable, which is what keeps the clients and
`vite-plugins/contentSecurityPolicy.js` agreeing on one address. `/` there means
the backend is behind the page's own host, so `connect-src` stays `'self'` and no
CORS is involved. **No hosting provider is named anywhere in `src/`**; a deployment
is those three values and the server's `CORS_ORIGINS`. Mock data is a *runtime* choice, not a flag: the assist
panel's "use sample suggestions" checkbox passes `useDummy` down to
`llmClientFactory`, which also falls back to samples whenever `LLM_ENABLED` is false.
**Samples are the demo process's only** (`suggestionsAreSample` in `GraphPanel`):
they are about its topic, so in a reader's own process, with no LLM or no key,
the assist tabs are disabled instead and the key notice asks for a key. The
guided tour likewise runs on the demo — from anywhere else, ☰/? asks before
leaving for a fresh demo (`requestTour` in `REState`).

Tests: `npm test` (Vitest, jsdom) and `npm run test:e2e` (Playwright — see `e2e/README.md`).
Both pin `VITE_APP_ENV=demo` (`test.env` in `vite.config.js`, `webServer.env` in
`playwright.config.js`), so a local `.env` cannot turn the backend on under them:
a test that needs it says so itself. Unpinned, whole-app renders fired real
requests at no server, and a failure landing after its file had finished broke
the run with "Closing rpc while onUserConsoleLog was pending".

The exception is Playwright's `live-backend` project, which starts the real
FastAPI server and runs the SPA against it — see `e2e/README.md`. **History's
"Calculate Z-scores per round" scores the whole process** (`wholeProcess`, from
`REState`), not the text panel's `state`, which on the History tab is the
projection at the round being played: on arrival that is round 0 with nothing in
it, which the server refuses, and later it held only the rounds played so far.
The chart marks the played round and dims those after it itself. That live
project is what found it.

## Key files

- `src/App.jsx` — root component
- `src/components/REState.jsx` — main state management and layout
- `src/components/Graph.jsx` — the Graph tab's canvas: hooks, click and tap
  wiring, and its drawing layers. What it draws and how it fades is
  `utils/graphView.js` (`drawnOnGraph`, `graphHighlights`), plain functions with
  their own tests; its add buttons, ctrl+click bar and add dialogs are in
  `src/components/graph/`.
- `src/components/workflows/` — JudgmentElicitTab, PrincipleSuggestTab, RelationSuggestTab, ProcessReviewTab, QuestionnaireTab, ElementMergeTab (after a merge only; see the root CLAUDE.md)
- `src/utils/` — LLM client, workflow utilities, state utilities
- `src/state.js`, `types.js`, `config.js` — app state and config
- `src/constants/colors.js` — `C` object with all viz colors

## Background theories

`TheorySuggestTab` — the workflow's third phase, and the only element type that
had no LLM path before it. The domain note is in the root `CLAUDE.md`; what
matters on this side:

- **The workflow's third phase**, between principles and arguments: it takes
  `autoFetch`, `workflowPhase` and the next-phase control like the other four,
  and `workflowUtils.test.js` pins `WORKFLOW_NEXT_PHASE` and `ASSIST_TABS` to the
  same order, so the tab strip cannot say one thing and the button another.
- **The principle count gates the auto-fetch, not only the button.** Every phase
  asking with nothing to work from wastes an LLM call; this one would spend a
  round of Crossref lookups on top of it, on suggestions the tab has already said
  it cannot make. That guard is what the earlier `autoFetch={false}` bought, kept
  now that the tab is a phase and fetching on arrival is the point.
- **`utils/citation.js` is one ordering function with two renderers** —
  `<Citation>` maps its runs to `<em>`, `citationMarkdown` wraps them in `*`. That
  is what lets the export carry italics without a parser or model-supplied
  markup, and what stops screen and export drifting apart. `esc` is passed *into*
  `citationMarkdown` to be applied per run: escaping the finished string would
  put a backslash in front of every emphasis marker it had just added.
- **The card shows references with their verification state, and the element card
  shows them again.** Without the second, the citation is invisible between
  accepting a suggestion and exporting it — which is most of the time the user
  spends with it.
- **Modify allows removing a reference, never editing one.** A rewritten theory
  can otherwise keep a citation that no longer supports what it says; editing in
  place would invite correcting a fabricated reference into a plausible one.
- **`verification` is stripped on accept and `doi` is kept.** A verdict goes
  stale as Crossref indexes more; a DOI it yielded does not.
- **A card is a theory and its references, and nothing about how either relates
  to existing elements.** That is the Relations tab's job.
- The sample fixture carries the verification states itself, since the demo build
  has no backend and nothing is ever checked there. It also holds one suggestion
  with no sources — a state that is otherwise never seen.

### Header colours

Every assist tab header wears **the graph constant for what its tab produces,
exactly** — `headerAccent()` in `constants/palettes.js` is the single place that
decides which, and `useHeaderAccent()` is how a tab asks. Judgments takes
`judgment.high`, Arguments takes `edges.entails`, and so on; Review takes none,
because prose about the whole process belongs to no type.

**In the default mode several of those are under AA as 12px type** — the judgment
blue reads 2.83:1 on the dark panel — and that is deliberate, by exactly the
reasoning the node ramp already carries: the default palette is judged by eye and
high-contrast mode is the compliant path. Do not "fix" them by nudging the hue;
a header that is nearly the constant is a different colour from the nodes.

**In high-contrast mode the header becomes a badge drawn the way the node is
drawn**: filled with the constant, written in the ink that fill takes — the
palette's own `ink` for an element type, `inkOn(fill)` for the two relation
colours no node wears. A yellow Theories badge with black type reads as the same
object as a yellow theory diamond with a black id on it, which no amount of tuned
foreground colour ever quite does. In both themes rather than only the light one
where contrast actually fails: a tab that changed shape when you switched theme
would read as a rendering fault rather than as a property of the mode. The badge
goes on the run button too, since it carries the same accent.

An earlier version filled the badge with black instead and applied it to *every*
header. Two things went wrong, both worth not repeating: the black ground made
the badge a foreign object next to the nodes it names, and Review — which takes
no graph colour — got a black chip carrying the panel's own text colour, which in
the light theme is near-black on near-black. A tab that names no element or
relation now takes **neither colour nor badge**, and `palettes.test.js` pins
`headerAccent(…, "processReview") === null` in both palettes.

**Weight follows the ink**, by `inkWeight()` and for the same reason node ids do:
bold on the panel, where thin coloured type at 12px needs the weight to hold its
colour, and normal on the badge, where the dark ink goes blobby with it. Dropping
the bold does not move the AA threshold — 12px is below the large-text cutoff
either way — so the badge still has to clear 4.5:1 on its own.

`data-accent="graph"` marks the elements that carry a graph colour. The audit
uses it both ways: `axeViolations(page, { ignoreGraphAccents: true })` excuses
them in the default mode, and a dedicated test walks all five coloured tabs in
both themes with high-contrast on and requires them to clear AA. That test
reports "no header on this tab carries a graph accent" rather than passing when
it finds nothing — which is what caught the lazy-chunk race it now waits out.

The Arguments tab's added-premise badges keep the judgment blue: those are about
the judgments being added, not the arrows the argument becomes.

### Relation colours vary by mode

`PALETTES.*.edges` holds them, and **anything drawing a relation must read
`palette.edges[type]`** — `C.supports` and friends are still in colors.js because
they double as general UI accents (a primary button's teal, a reject's orange)
and must not move when the graph's palette does.

The accessible set is the same five hues moved into the luminance band that is
legible on both canvases *and* as type on the header chip: roughly 0.175–0.265,
which is narrow. They are deliberately not all at one luminance, since that is
the channel red-green deficiency leaves intact. What the set fixes is contrast,
not hue separation — orange, yellow and green stay confusable, and what carries
them apart is the redundancy already there: dash pattern and arrowhead.

Five places draw an edge and all five take the palette: `ArrowDefs`,
`GraphEdge` (in `graphs_shared/`, exported through `GraphElements.jsx` with the
graph's other drawing components), `graphRender.renderJointArgument` (a plain function, so its two
callers — `Graph` and `HistoryTab` — pass it in), `Legend`, and `generateSVG`.

## Process review

`ProcessReviewTab` — the one Assist tab whose output is prose *about* the graph
rather than a change to it. The domain note is in the root `CLAUDE.md`; what
matters on this side:

- **A stop between iterations, not a phase of one.** It stays out of
  `WORKFLOW_NEXT_PHASE`, which is the iteration and only the iteration; it is in
  `WORKFLOW_PHASE_LABELS`, because the next-phase button has to be able to
  announce it. `nextWorkflowPhase` inserts it every `REVIEW_EVERY` iterations,
  and is the only route to it. Its place last in `ASSIST_TABS` is deliberate —
  the five before it are the iteration's phases, in run order, and this one runs
  after all five.
- **The round gate holds the auto-fetch, not only the button.** `autoFetch` is
  on for the *whole panel* whenever a workflow is running, so this tab fires on
  arrival like the other five; `state.log.length >= 2` is what stops it asking
  for a reading of a process too short to have moved, which a reader looping
  quickly can reach. Every phase carries a gate of this shape — Theories has the
  same one on its principle count.
- **The tab does not decide where the workflow goes next.** `REState` computes
  `workflowNextPhase` and hands it down; `ProgressWorkflowBtn` takes it as
  `nextPhase` and only looks up the label. It used to re-derive the destination
  from `workflowPhase` plus a `hideNonEntailsRels` default of `true` its own
  caller never passed, so the button already announced one phase while the press
  went to another. Two routers is one too many.
- **One review is carried as a one-element `suggestions` list.** That is the
  shape `useSuggestionWorkflow` consumes, and the fit is otherwise exact: a
  review *is* a suggestion the user accepts, rejects, or modifies. The sample
  fixture is stored already in that shape, since `makeLLMClient` serves
  `dummyData` without running `transformResponse`.
- **Modify is per-section**, so `editing.draft` is an object of five strings
  rather than one, and the origin stamp goes through `llmOrigin` as everywhere
  else. Saved reviews are delete-only: editing happens before acceptance, which
  is what keeps `origin` honest.

## Questionnaire mode

A guided RE mode where all elements and argument relations are pre-populated from a spec file; the user answers questions to activate their chosen path through the argument graph.

- **Specs live in `src/questionnaires/*.js`** — each file exports its spec as `default`. `HomePage` uses `import.meta.glob` to auto-discover them and render a card per spec; no wiring needed to add a new questionnaire.
- **Spec shape:** `{ id, name, card: { title, description, buttonLabel }, suggestions, participantArguments, furtherArguments }`. `id` is a short identifier used as the `origin` field on generated elements. `description` is a string or an array of strings and `{ link, href }` objects for inline links.
- **State:** `model: "questionnaire"` and `questionnaireSpec` are set on the state. Elements carry a `questionnaireIndex` (integer) that matches their position in the spec's argument arrays.
- **`QuestionnaireTab`** (`src/components/workflows/QuestionnaireTab.jsx`) renders the participant questions (those whose `question` starts with `"Q"`) and calls `onQuestionnaireSelectAnswer` on selection.
- **`handleQuestionnaireSelectAnswer`** in `useREActions.js` activates the chosen element, resets siblings to `"possible"`, and auto-activates pure-conclusion elements whenever all premises of any argument leading to them become active.

## Text panel cards

A card is the claim first and everything said about it second, and the layout
says so: the id badge and the two action buttons on one line, the statement
under them, a rule, and then the stats. `text_panel/TextTabCards.jsx` builds
them out of the primitives in `TextTabPrimitives.jsx`.

- **A stat is a caption over a value** (`StatField`), not a bordered chip. A
  chip has to carry its own name inside it — "Confidence: Moderate" — which
  spends the width twice and leaves a row of pills that all look alike to be
  read one at a time. With the names on their own line the values line up down
  the column and can be scanned without them. `MetaChip` is still right for a
  *set* of short values, where the name belongs to the set: the ids a principle
  covers, a cluster's members. **Its border is the chip colour at a third only
  when that colour is a hex** — `C.dim` is `var(--c-dim)` and `var(--c-dim)55`
  is not a colour, so the declaration was dropped and the default chip had no
  border at all; those take `C.border` instead.
- **The fields are a grid, not a row** (`cardStats`), of `auto-fill` columns at
  a 110px minimum. Packed in a row, every field's position depends on the width
  of the text before it, so a column of cards had its origins and rounds in a
  different place on every line. Values are held to one ellipsised line for the
  same reason — a value that wraps moves the rows under it — which is why
  anything that might not fit passes `title`. `Covers` is the exception and
  takes `span={2}` with `wrap`: the ids *are* the content, so that is the one
  field whose tail must not be eaten.
- **The details fold is one answer for the whole panel**, not one per card —
  `text_panel/cardDetails.js`, a module store on `storedPref` in the shape
  `tourWidth.js` uses, read by every card through `useCardDetails()`. The
  statement is what a reader scans a list for and the stats are what they look
  at once they have found one, so folding is them saying how they want to read
  the *list*; per card it took two dozen presses to mean it. It outlives the
  panel too, since leaving the text tab and coming back is not an instruction
  to unfold everything again. The region is hidden with `display` rather than
  unmounted.
- **A revision is announced by the previous-wording panel, not by a stat.** Its
  heading carries the round ("Revised in round 4 · Previous wording"), so a
  `Status: Revised` field beside it would say the same thing twice. Every other
  event — withdrawn, rejected, reinstated — gets the `Status` field, coloured by
  the event. A revision that left no `previousText` behind, which hand-written
  and imported states allow, falls back to the field.
- **The withdrawal scores are bars** (`StatSection`, `DeltaBar`). The number is
  what a reader acts on, so it is written out and the bar is `aria-hidden`. The
  bar takes the graph hue and the number takes that hue's foreground tone
  (`C.supportsText`), the teal being illegible as type on the light panel.
- **Their scale is `utils/withdrawalScale.js`, and it is neither 0–1 nor a
  fixed maximum.** Withdrawing an element moves account by `(2D ± 1)/N²` — a
  few hundredths on any real process, and *smaller the larger the process gets*
  (the sample's own numbers are 0.014–0.048 for account and 0.052–0.172 for
  systematicity), so a 0–1 bar spent 95% of its width on unreachable ground.
  That `1/N²` is also why no fixed maximum serves: generous enough for a
  six-element process leaves a forty-element one flat. So the maximum is the
  smallest of `[0.05, 0.1, 0.2, 0.5, 1]` that holds every delta on screen,
  memoised in `TextTab` and handed to every card through the context — **one
  scale for the whole panel**, which is what makes the lengths a comparison
  between elements, the question the bars are actually asked. Quantised because
  an unrounded peer maximum redraws every bar on each recompute and always
  leaves one element at full width, which reads as a verdict; floored at 0.05 so
  a panel whose largest score moves by 0.002 shows empty tracks rather than full
  ones. The scale is named in each bar's `title`, there being no visible axis.
- **`data-stat` and `data-card="element"` are structural hooks, and the tests
  depend on them.** The e2e helpers used to find a card by climbing from a
  "Revise" button while the ancestor held one "Confidence:" label; the fold can
  now hide that label, so the climb ran to the whole list. `elementCardTexts`
  and the "↑ Top" overlap test query the card root directly.

## One tooltip

`components/Tooltip.jsx` is the app's only tooltip, and **nothing sets a DOM
`title`**. A native tooltip is a different box in a different font on a different
delay, it cannot be reached by a finger at all, and having both meant a disabled
run button was explained twice at once — the native box over the app's own. The
shared primitives take the hover text as a `title` *prop* and render a `Tooltip`
with it (`MetaChip`, `StatField`, `DeltaBar`, `SectionHeader`'s add button), so
most call sites never mention it.

Two things to know before adding one:

- **A disabled control needs `wrap`.** A disabled button fires no mouse events,
  so a tooltip bound to it never opens — and "why can't I press this?" is
  exactly when it is wanted. `wrap` listens on a span around the child instead
  and leaves the child alone, which also means the child must carry its own
  accessible name. That is what the run buttons, the step button, the LLM
  modal's Test/Save and the sample-data checkbox pass. It is also why `title`
  survived beside a `Tooltip` on those buttons for so long: the native box was
  the only one that showed.
- **Tooltip names an icon-only trigger for free.** It sets `aria-label` from the
  text when the child has no visible text of its own and no label already. A
  trigger whose visible text is a symbol — `×`, `✕` — counts as text to it, so
  those keep their own `aria-label` beside the tooltip.

A test cannot read a `title` any more: `components/tooltipTestUtils.js` has
`tooltipText(node)`, which hovers, waits out the delay and returns what the
portal says.

## Visualization conventions

Colorblind-safe palette. Two modules, and the split matters:

- `src/constants/colors.js` — everything that does **not** vary by mode: edges,
  states, surfaces, and the per-type *foreground* tones (`C.judgment.text`, …).
- `src/constants/palettes.js` — the node **fills** and the label ink, which do.

Edges: teal (supports), orange (conflicts), amber (undermines);
green (entails) and rose (precludes), hollow arrowhead for the single-premise
forms and filled for the joint ones. Withdrawn: grey at 25% opacity; rejected:
rose at 35%.

### Viewing modes

Two palettes, resolved by `resolvePalette(accessible)` and reached in components
through `usePalette()` from `hooks/useTheme.js`. **Never import a node fill
directly** — a component holding a hex is a component that is wrong in one of the
modes. The theme is *not* a parameter: the fills are the same on both grounds.

| Mode | Judgment · Principle · Theory | Ink | Guarantee |
|---|---|---|---|
| `default` | blue · violet · amber, pale → saturated | white, bold | none — see below |
| `accessible` | pale blue · pink · yellow | black, normal | AAA (7:1) throughout |

**The default palette does not clear AA on its pale end, and that is a decision,
not a bug.** No single ink can serve that ramp: it runs from tints that want dark
type to tones that want light, crossing at ~0.183 relative luminance. White is
chosen for the saturated end, where the eye goes (5.2–5.7:1), and falls to
1.4–1.9:1 on the tints. Rather than compromise the palette, the compliant path is
offered as the **high-contrast mode** in the ☰ menu. `constants/palettes.test.js`
holds each palette to what it actually promises — don't "fix" the default one to
AA, and don't re-tone these fills to chase a ratio.

Weight follows the ink via `inkWeight()` — light ink bold, dark ink normal — so a
palette can't arrive with the wrong one.

The mode lives on `<html>` (`data-theme`, `data-contrast`) — that is the single
source of truth, and `useTheme` reads it rather than mirroring it.

Two things deliberately do *not* use `palette.ink`: the graph's `+J/+P/+T`
buttons and the questionnaire card's button. They are HTML, where axe enforces AA
in the e2e audit, so they take `inkOn(fill)` instead. The nodes are the exception
to AA; a button generally is not — the add buttons are the exception, and are
marked as such; see the ink note further down.

**The text panel's id badge is a node.** `useTextTabData` gives it
`typeTokens(type, palette).high` and `inkOn()` of that — the same two lines
`Graph.jsx` uses for the `+J/+P/+T` buttons — so a `P` badge and a principle node
are one colour in whichever mode is in force. It was a chip tinted with the
node's `stroke` and written in `typeTokens(type).text`, and that ink is a CSS
variable that varies by theme but **not** by contrast mode: in high-contrast the
tint moved to the accessible ramp and the ink stayed on the default one, so a
magenta node wore a violet badge. A tint cannot be fixed in place, either — its
ink has to read against the *panel*, and neither ramp holds a tone dark enough to
do that on the light one, which is why the badge is filled rather than re-tinted.

**Any button on a filled ground asks for its ink rather than naming one.** What
it asks is settled by whether the fill is a graph colour the reader is meant to
recognise. A one-off fill asks `inkOn(fill)`, which picks whichever of the two
inks reads on it; a control wearing a graph constant takes `palette.ink` and
`inkWeight()` of it, which is how the mode's own ink follows the colour. Either
way the *fill* is untouched — re-toning one to chase a ratio is the thing that is
forbidden.

**Every add button is one button** — which since the bar became the app's only
add form is one button in the literal sense: `AddBar`'s submit, whichever of its
tabs is lit. It wears `C.supports` and the palette's ink on it: white and bold in
the default mode, black and unweighted in high-contrast, exactly as an assist
tab's header badge is written. Adding a judgment from an assist tab is the same
act as adding one from the bar, and the two looked like different acts while the
assist tabs had panels that coloured their own.

White on that teal is 2.43:1 in the default mode, taken knowingly and by the same
reasoning as the node ramp: judged by eye there, compliant in high-contrast, where
the pair clears AAA. So the bar's filled buttons carry `ACCENT_MARKER`
(`data-accent="graph"`, in `addPanelShared.js`), the editor and assist audits pass
`ignoreGraphAccents` — default mode only, as everywhere — and the high-contrast
e2e test picks them up for free, since it walks exactly that attribute.
`AddBar.test.jsx` pins the fill, the ink and the weight per mode, which
is what stops a hex being written back in; it has been written in by hand once in
each direction already.

### Groups

User-defined boxes around nodes, collapsible to one node each. State lives in
`state.groups`; the domain note is in the root `CLAUDE.md`.

- `utils/groupUtils.js` — the pure half. `projectGroups()` is the whole feature:
  it rewrites the visible elements, relations and positions so a collapsed group
  is one node. Everything that draws the graph consumes its output — `Graph.jsx`
  and `generateSVG.js` alike, so a downloaded graph is the graph on screen.
- **A group is not a fourth element type.** It has no type ramp and no
  confidence, so it takes no palette fill: the disc is `C.panel` inside a `C.dim`
  outline, the app's own "this is a container" pairing. Ask `elementRadius(el)`
  rather than `nodeRadius(el.type, el.confidence)` — that pair is exactly what a
  group node lacks.
- **Re-pointed edges are copies.** Selection compares relations by identity, so
  `projectGroups` returns a `relSource` map back to the relation held in state,
  which `Graph.jsx` passes to `useGraphClick` as `toSourceRel`. Relations it had
  no reason to rewrite are the very objects passed in — don't "simplify" that
  into copying them all.
- Identity is drawn in SVG (the hull, the disc, the name); the *actions* are HTML
  buttons in `graphs_shared/GroupChips.jsx`, so they get a tab stop and a name.
- The layout knows about groups: `useStablePositions` pulls members together and
  packs collapsed ones tighter. The History tab deliberately does not collapse —
  playback is about the process, not about how the user has filed it.

**Two ways in, and they mean different things.** `createGroup` takes a canvas
selection, which is a vague instruction — "these belong together" — so it folds
into whatever group the selection already touches, which is what makes "pick a
node and a member, then Group" read as *adding* to that group. `upsertGroup`
takes the dialog's list, which is exact: an element ticked there *moves* out of
the group that had it, and a group left under two members is dissolved.

**Where the feature announces itself.** A canvas gives no hint that a modifier
key does anything, so grouping is reachable three ways: `+ Grp` in the graph
toolbar, the `+` on the text panel's Groups section — which renders even at zero,
carrying the prose that explains the feature — and the `Group` button on the
ctrl+click selection bar. `GroupModal` is the single dialog behind the first two
and behind every chip's pencil; it does name and membership together, because
those are the only two things a group is.

**The panel is not decoration.** A collapsed group's members are by design what
the canvas cannot show, and `text_panel/TextTabGroupSection.jsx` is the one place
they stay spelled out — hence the per-member "×" there, and the Expand/Edit/
Ungroup handles matching the canvas chips. Every element card also carries a
`Group: …` tag, so the panel never looks like it disagrees with a canvas that is
not drawing it.

**A group can be selected, exactly as an element can** — from its disc, from
inside an expanded group's box, from the panel's group chip, or from an element's
group tag. Selection is still one id, so `selectionIds()` is what turns that id
into what it covers: the group's node *and* its members. Both `Graph.jsx` and
`useTextTabData.js` highlight from it, which is what keeps them agreeing.
Reading the id literally is what left a selected group showing "G1" over an
empty card, since neither surface holds anything by that name.

**Two rules the canvas depends on.** Clicking a collapsed group *opens* it — a
group is a lid, and it re-asserts the selection rather than toggling it, because
the thing clicked is about to be replaced by the members underneath. And chips
are drawn for the selected group only: one over every group turned the canvas
into a row of toolbars. So opening a group keeps hold of it (the handle to close
it again has to stay under the hand), `handleSaveGroup` keeps hold of what it
saved, and **closing one lets go** — putting a group away and leaving its
toolbar floating over the result is the clutter collapsing was asked to remove.

**`onSelect` and `onSelectRel` are not independent.** `useREActions` couples
them: each clears the other's selection. A handler that calls both in sequence
therefore has its second updater run against state the first already blanked —
which is how letting go of a group by clicking its box came to re-select it
instead. Test harnesses must couple them the same way or they will not see it.

### Confidence

Reads two ways, and does **not** fade the node: it tints the fill (`low` → `high`)
and, mainly, scales the radius — 65%–120% of base, so a confident element has
~3.4× the area of a tentative one. The 65% floor is set by the label, being the
smallest node that still contains a three-character id at 11px bold. Opacity is
reserved for *state*: dimmed by a selection elsewhere, withdrawn, rejected.

Selection follows the user's pointer only: clicking a node or a text card. Actions
taken on an element (revising, withdrawing) deliberately leave it alone, since
selection dims the rest of the graph.

Tabs: Graph (D3 force-directed), Text, History (slider, 3.2s/round). Node positions stable via shared force simulation on all elements including withdrawn.

**A resize moves the layout; it does not redo it.** `useStablePositions` shifts
every node by the move of the centre and re-aims the centring forces, without
reheating the simulation. It used to restart at full heat on any size change
`useCoarseDims` let through — going full screen is one — and every node spent
seconds on the move for a layout whose shape nothing had asked to change. Only
elements, relations or groups changing re-run it.

### The keyboard

**The canvas is pointer-only, and the text panel is the keyboard's way in.**
Growing a card and showing what an edge says answer a pointer or a finger, and
nothing on the canvas takes the focus. Everything they offer is in the text
panel — every statement whole, every relation with its explanation — so that
panel has to work without a mouse, and `e2e/a11y.spec.js` ("the text panel can
be worked by keyboard alone") walks it: search, fold a section, select a
relation and an element, open Revise, Tab, Escape.

What that walk found, and what fixed it:

- **A section folds by a button** (`SectionHeader`, `aria-expanded`), beside
  its "+" rather than around it. It was the header's click, on a div.
- **A relation row is selected by a button** (`RowSelect`, the type between its
  ends, `aria-pressed`, named "Select relation: J1 supports P1"). The row was a
  clickable div; its end badges were buttons that said "Select J1" and, their
  click bubbling, selected the relation — so they are `inert` in a row now.
  **A row never selected anything, mouse or keyboard**: its handler called
  `onSelect(() => null)` after `onSelectRel`, and the two are coupled
  (`useREActions`), so the second cleared what the first had set. Unit tests
  missed it because their harness setters were independent.
- **Every dialog is a dialog** (`ModalShell`, which all add, edit and withdraw
  forms are): announced, focused on opening, Tab kept inside, Escape to close,
  focus handed back to what opened it. It had none of that.
- **The search box is named and shows its focus**; it had `outline: none`.

The spec's catch-all — nothing showing a pointer that neither takes the focus
nor holds something that does — would not have found the first two: both held
*a* button, just not one that did their job. The walk's explicit steps did.

### Search, on the graph

The text panel's search also lights up the graph: what it does not find fades
by the selection's own fade, so a search reads as a selection made by typing.
**The graph lights exactly what the panel lists** — an edge by the panel's test
for a relation, asked of the relation held in state, and not merely for having
a found element at one end, which lit edges the panel did not list. In the card
view the words it found are marked on the card (`SearchMarks` — underlined in
the panel mark's teal, not bolded: a card is sized to its text, and bold runs
wider).

- **`REState` holds the query**, passing it to the panel (`search`/`onSearch`;
  `TextTab` keeps its own when given none) and to the graph.
- **Only while the panel is on screen.** Full screen hides the search box, and
  a graph still filtered by a query nobody can see or clear would look broken.
- **The panel's own tests** (`matchesSearch`, `matchesSearchRel`), so the two
  cannot disagree about what matches; `searchFinds`, beside them in
  `utils/textTabHelpers.js`, applies the first to what the canvas draws, a
  collapsed group being found through its members.

### Following the selection

An element or relation selected while not wholly on the Graph tab's canvas —
picked in the text panel, most often — is **glided to** (`usePanGlide` in
`hooks/useViewGlide.js`), at the zoom the reader has; `prefers-reduced-motion`
jumps. A relation is its ends, and a joint argument's step is the whole
argument, every premise and the conclusion (`relationEnds` in `Graph.jsx`),
since that is what lights up. **The whole node counts**, card and all, and the strip down the right
edge under the add and zoom buttons does not count as visible: testing the
centre left a statement card standing half off the edge. One that is lost, or
too big to show whole, is centred; one that is only cut off moves just far
enough to be whole, which also applies to a click on a half-hidden node. The
card a click pins moves with the view (`glideTo`'s `onMove`), being placed in
page coordinates. A pointer, the wheel or the fit button takes the
view over mid-glide and keeps it. Two guards: it acts on a *change* of
selection only, not on the graph mounting with one (the opening fit has the
view then), and a selection arriving in the same render as the tour's `focus`
does not glide — the tour selects and frames together, and its framing wins.

**Double-click** is Revise on a node and fit on the background (the fit
button's other way in, on the History and Cluster canvases too). A double-click
is two clicks first, which select the node and let it go; the handler selects it
again and shuts the card they pinned, so the dialog opens over a held node that
stays held. **Escape** clears the selection — and with it a ctrl+click chain and
the pinned card — from the handler beside undo in `REState`; a dialog or an open
dropdown stops its own Escape, and the tour's closes the tour instead.

### An edge's explanation

Relations carry an `explanation` the graph used to draw nowhere. On the Graph
and History tabs, **a mouse over an edge — or a tap on one — shows a box** (`RelationLabel`)
with the relation's type and its explanation, anchored at the edge's midpoint or
at a joint argument's junction, which gathers its premises' distinct
explanations. In both views, not only the statement view: an explanation is
worth reading whether or not the statements are shown. Nothing over a node,
which answers for itself, and nothing mid-pan.

- **One hit test for click, hover and tap**: `relationAt` in `graphHelpers.js`,
  lifted out of `useGraphClick`'s click handler. Joint arguments have no hover area of their
  own, so a hover on the drawn edges could not have found them; asking the
  geometry does, and the three cannot disagree about which edge is under the
  pointer.
- **Held at one size on screen** by scaling against the zoom: a box zoomed out
  with the graph would be illegible exactly when the graph is too small to
  follow without it. Outlined in the edge's colour, written in the text
  colours — the relation colours are not all legible as type.
- **The state changes only when the edge does** (`useShownRelation`, which
  both tabs use), so a pointer moving
  along one re-renders nothing; the box is drawn only while its relation still
  is. Type names come from `RELATION_LABELS`, which the legend reads too.
- **The History tab too**, by the same test — `relationAt` is a plain function
  in `graphHelpers.js`, which `useGraphClick` and `HistoryTab` both ask. There
  the box carries the wording the round being played gave the relation
  (`asOfRound`), and a relation not yet added, drawn invisible, says nothing.

### Statement view

The card-icon switch above the zoom buttons (`StatementToggle`,
`StatementCardIcon` — not "Aa", which is the font setting's) draws each element
as a **card**: the
node at its usual size as a badge on the left, the wording beside it.
`hooks/useStatementView.js` is the state and wiring, `utils/statementCards.js`
the geometry. The Graph and History tabs, by the one switch; the Cluster tab and
the text panel do not follow it.

**In the History tab** the cards carry the wording each element had in the
round being played (`asOfRound`), so playback shows statements being revised.
They are laid out at each card's **largest wording over the whole process**
(`widestCard`, passed as `layoutCardOf`), so the layout holds still through
playback: laid out by the round's own wording, every revision would push the
cards about afresh. That is also why the overlap pass is keyed on the boxes it
lays out rather than on the wording. Growing on hover and tap is the Graph
tab's, from the same hook (`hooks/useCardGrowth.js`, `cardAt` for this canvas's
taps, having no `useGraphClick`); a card not yet added, drawn invisible, answers
neither.

**The switch is a module store** (`utils/statementViewSetting.js`, remembered
per browser), because **the Markdown export's graph follows it** — the one view
setting it does follow. "The graph as you left it" drawn as nodes when the
reader left it as cards would not be that; the palette, by contrast, is how a
reader sees the graph, not what it says, and the export keeps ignoring it.
`REState` reads the switch when Export is pressed and passes `{ statements }` to
`buildMarkdown`, whose graph section lays the cards out afresh with
`statementGraph` — the canvas's own spread and push, without the warm start,
there being no earlier frame. The cluster diagrams stay nodes, as the Clusters
tab does. A separate "download this view" button came first and was dropped:
two exports of one graph that disagreed was the problem, not the solution.

`generateGraphSVG` draws a card for any element carrying `card`, fills under
the edges as on the canvas, and names the page font the cards were measured in.
**Each line is held to its measured width** (`textLength` from the card's
`widths`, `lengthAdjust="spacingAndGlyphs"`), so the text fits its box in
whatever font the file is opened with — naming the font alone left it to
overflow on a machine without it. Glyphs as well as spacing, so a wider font is
squeezed a little rather than overlapping its own letters. The canvas needs
none of this: it draws in the font it measured in. Attribute values go
through `escAttr`, since a font list read off the page quotes its multi-word
names. **Every relation type has an arrowhead** — hollow for `entails` and
`precludes`, filled for the rest, as on the canvas; the four inferential types
used to have none. Heads are in user space (10 × 10px whatever the line width)
and anchored at their base, where `arrowGeometry` ends the line, so the tip
lands on the border.

- **A card, not a node with a label under it.** The first version hung the text
  under an enlarged node, and two objects per element was the mess. The badge
  keeps shape for type and size and fill for confidence, so nothing the node
  said is lost. Text does not fit *inside* a node at any readable size.
- **Everything reads the card off a display copy** (`card` on the element, never
  on state). Edges meet it at its border through `boundaryDistance`, clicks
  land on it through `hitsElement` — ask those rather than `elementRadius`
  wherever an edge or a pointer meets a node. The rings (`NodeRing`,
  `PulseRing`) and the off-screen arrows take the box too.
- **Measured before it is drawn**, because edges need the border before
  anything is laid out: `utils/textWidth.js` measures on an `OffscreenCanvas`
  in the font the SVG text inherits (the reader's, from ☰ → Font — the hook
  watches `<html>`'s style for a change), and lines wrap by that width. An
  estimate at monospace widths came first and put the last characters on the
  border, the canvas's monospace running wider than assumed. The estimate
  survives only where nothing can measure: jsdom, so the tests.
- **Switching glides** (`hooks/useViewGlide.js`, ~320ms, eased — the statement
  view marks its departure with `depart()` at the press): every element from
  where it stood to where it is going, and pan and zoom to the new framing with
  them, so the reader follows each node to its card and back. The shapes swap
  at once; the places move. The departure is taken **at the press**, since by
  the effect that runs after it the new view's positions are already the
  answer. `prefers-reduced-motion` gets the jump instead, and so do the tests
  that look at where things land — they stub `matchMedia`; "gliding between
  views" drives frames by hand. Progress is clamped at 0, a frame's timestamp
  being able to precede the glide's start.
- **Zoomed far out, cards go one line deep** (`compactMaxLines`), below 30%
  and back above 36% — the gap is so a zoom resting near the line does not
  flicker. At 30% the 14px text is about 4px on screen, and four lines of it
  only cover the canvas. It started at 45%, which is about where the fitted
  view of a few dozen elements opens — so the graph's first view was one line
  a card, at a size still read. **Laid out full size regardless**: `useStatementView`
  keeps `cardedEls` for the layout and draws `drawnEls`, so zooming never
  rearranges the graph — compact cards simply stand further apart.
- **Room comes from the settled layout, not a new one.** Positions are spread
  1.5× about their centroid, then only overlapping cards are pushed apart,
  connected ones to a wider gap so the edge between them has length. The
  arrangement the reader knows survives the switch both ways.
- **Cards are remembered** (`statementCard`), by type, confidence, wording,
  line limit and measurer, and frozen — the canvases ask for every element's on
  every render, which while the layout settles is every tick. A variant is a
  copy (`{ ...card, hovered: true }`), never an edit.
- **The pass parts a pair by 1.5× the overlap** (`PUSH`, ¾ each), not exactly:
  parted exactly, a chain of cards nudged its neighbours back into contact and
  the pass crept — 30 cards at the canvas's density still overlapping after its
  200 passes. From 60 cards it compares only neighbours on a grid rebuilt each
  pass (`nearPairs`); below, every pair, so small graphs lay out as they did.
  It clears anything the force layout hands it; a true pile of wide cards in a
  small patch it does not, and does not need to.
- **That pass must stay continuous** (`nextStatementLayout`). Run afresh on every
  simulation tick, it turned a sub-pixel settle into a minute of jiggling, since
  a tiny shift can flip which way a pair is pushed. So moves under 2px are not
  passed on, and a run starts from the last result shifted by how far each node
  moved. It starts afresh only when the cards or links change.
- **A withdrawn or rejected card stays readable.** Nodes fade whole for their
  state; a card faded whole left its wording all but illegible, and reading it
  is the view's point. So `graphNodeVisuals` hands a card its state as `fade`
  and keeps `opacity` for a selection's dimming: badge and outline fade (grey or
  rose, id struck through), the wording turns `C.dim` at full strength, the
  background stays opaque. The export draws them the same way.
- **The fill is drawn under the edges** (`CardBackground`), the outline, badge
  and text over them, with a halo on the text. An opaque card over the edges hid
  every edge behind it; a translucent one only half-hid them.
- **A hovered card grows to its whole statement** (`expandedCard`), when four
  lines cut it short. **The card itself grows** — `Graph` swaps the grown copy
  in for it and moves it last so it is drawn over its neighbours. A first
  version laid a second card over the selected one, which doubled every border
  and tied reading a statement to selecting it, which dims the rest of the
  graph. It grows from its own top-left corner with the badge and first lines
  left in place, fills itself, and stays **out of the layout** — a card that
  pushed its neighbours aside whenever the pointer crossed it would reshuffle
  the graph under the reader. `useGraphClick` asks it first (`overlay`), so a
  click on its grown part is a click on it and not on what it covers. Hovering
  a card opens no hover card; the details that one carried are on the card a
  click pins. **On a phone a tap grows it** (`onTap` in `useGraphClick`; a tap
  elsewhere lets it go), and the card's own mouse handlers stand down while the
  last real pointer was a finger (`lastPointer` in `hooks/useCardGrowth.js`,
  shared with the History tab, from pointer events, which the
  mouse a browser emulates after a tap does not raise). That emulation is
  unreliable enough to shrink a grown card at once — in Chromium it replays a
  move to wherever the mouse last was. A leave is also ignored while the pointer
  is still over the card's outline: growing moves the card to the end of the
  drawing, and moving a node under the pointer is reported as leaving it.
  `e2e/statement-cards.spec.js` covers both under the `mobile` project. The
  pinned details card **leaves out the statement** (`NodeTooltip`, on `el.card`),
  the card beside it already showing it; status, earlier wording, reason,
  confidence, origin and the actions stay. **Every hovered card answers with a heavier border** (`hovered`
  on the card, 2.5px against 1.5), grown or not: one whose statement already
  fits used to do nothing at all under the pointer.

## Panels the reader sizes

Two things in the wide layout are dragged rather than styled, and both remember
where they were left (`utils/storedPref.js` — localStorage that cannot throw,
since private-mode Safari denies it outright).

**The central divider** — `hooks/useSplitRatio.js`. **The ratio is the line's
position from the left edge of the row.** Analyze reads text-then-graph, an
assist tab anchors its own panel left and puts the companion right of it, and
**the left panel is the fixed one in both**: `panelWidth` goes on it, the right
one takes what is left with `flex: 1`, and the line sits on the divider's left
edge. Fixing the right panel on an assist tab — as it once did — put the line
at `100% − (1 − r)` there and `r` in analyze mode, and it visibly shifted on
every change of mode.

**The graph is one element for both modes** (`graphPanel` in `REState`),
right of the divider in the same slot of the row, so moving between an analyze
tab and an assist tab keeps the same canvas mounted. As two elements, one per
mode, every such change remounted it — pan and zoom reset, the view re-fitted,
and the graph flashed. The text panel, by contrast, takes a slot on each side,
so the keyboard reaches things in the order they are drawn.

Three things hang together and must stay that way. The divider **is** the
boundary: neither panel draws a border on the edge they share, or there are two
lines twelve pixels apart. It **replaces** the row's flex gap rather than sitting
in one (`gap: showDivider ? 0 : 12`), so a target wide enough to hit costs the
panels nothing. And `graphW` — which feeds the force simulation, not the CSS —
follows the ratio: a canvas centring its nodes for half a row it no longer has
puts them off-screen. `useCoarseDims` is what keeps that from re-laying-out the
graph on every frame of a drag.

**The add bar's two edges** — `hooks/useAddBarSize.js`, sizes in px on both axes,
top edge and right edge plus the corner. The phone sheet passes `enabled: false`:
there the bar is already most of the screen.

**Minimised is the third thing that hook stores**, with the height and the width
because all three are one reader saying how much of the window the bar may have.
Dragging it to its floor is not the same answer — the floor still leaves a bar,
and someone reading a graph wants the strip gone rather than short. It survives a
tab change and a reload; a bar that came back on its own would not be worth
folding away. Two rules the collapsed strip is built on: it **hides the bar
without clearing it**, so a half-written statement is still there on the way back;
and the strip is **one target**, the whole line being the button rather than a
24px chevron on a line, with the visible words as its accessible name (WCAG 2.5.3
— an `aria-label` of its own would have broken exactly that). The chevron is
`aria-hidden`, and the lit tab rides in the name, since which form is folded away
is what decides whether to open it.

**The bar is sized by its contents between two bounds, and the dragged height is
the floor rather than the size.** Its controls grow — an argument taking on
premises wraps its row two and three deep — and a bar pinned to a height its own
contents have outgrown clips them, which is how the text field came to be
squeezed out from under them. So the bar carries **no height at all** — an auto
height on a column is the height of what is in it — floored by the dragged
height (or the stylesheet's `ADD_BAR_MIN_HEIGHT`) and capped by `HEIGHT_CAP`;
past the content the top edge moves up, and past the cap the bar scrolls. Which
also means a bar that *opens* taller than the floor is one carrying a dragged
height, not a layout fault: double-clicking the top edge gives it back.

`height: max-content` says the same thing and was tried first. Don't: one engine
drew the bar at twice its contents from a standing start. `overflow-x: clip`
reads better than the `hidden` beside it too — `clip` is not a scroll port,
which is the point — and the same engine dropped it as unknown, which leaves the
axis scrolling and is the one thing the line is there to stop. Both are stated
the boring way now.

**Being a scroll container is why the fields are stretched rather than 100%
wide.** The bar has to be one, for the case where its controls outgrow it — and
that makes a field half a pixel too wide a horizontal scrollbar across the foot
of the window. A percentage of a fractional content box is exactly how that half
pixel arrives, and WebKit rounds it the wrong way; a stretched flex item is
exact. `alignSelf: "stretch"`, never `width: "100%"`, on anything filling one of
these panels — and `overflow-x: hidden` on the field itself, since a textarea
wraps and so has no legitimate use for a horizontal scroll port, while its
default `auto` will paint one for a fraction of a pixel. A viewport of an odd
width — any scaled display — is where that fraction comes from.

**Both bounds, and the floor takes the cap too.** In CSS a minimum wins over a
maximum, so a floor left uncapped holds the bar past the bottom of the window —
which is the other way a growing row goes wrong, and the one that gives the whole
page a scrollbar. `HEIGHT_CAP` is `min(50dvh, 100%)`: the window's share, and the
panel it sits in, whichever is smaller. The statement box keeps the floor
`TEXT_FIELD_MIN_HEIGHT` puts under every one of them — that floor is what the bar
grows *by*.

Nothing in the app is read by scrolling sideways — the graph is *panned*, which
is a transform — so a horizontal scrollbar is always a row that has failed to
wrap; `REState`'s `overflow-x: hidden` says so, but the fix is always the
wrapping — and the field width above, which is the other way one appears.

**One add bar, under every tab.** `AddBar` is the app's only add form. The assist
tabs used to carry a cut-down panel each — an element panel with the type fixed, a
relation panel and an argument panel, all in a `WorkflowAddPanels.jsx` that no
longer exists — which meant four forms for three kinds of thing, and they had
drifted: the panels' `+ premise` fell back to the full element pool where the
strip's did not, and the same two complaints were worded differently in each. What
those panels knew that the bar did not is which kind of thing their tab was about,
and that is a preset rather than a component.

`AddBar` (`user_edits/AddBar.jsx`) is the frame: the buttons, the
layout and the one text field. The three forms live in `useAddBarForms`, which
hands the frame the form on show as one record — its check, its text field, its
placeholder, submit and reset — so the frame never asks which tab is lit. The
checks are pure, beside `checkWrittenArgument` in `addPanelShared.js`, and each
returns `{ valid, complaint }` for the bar's one complaint slot. Each tab's
fields are in `AddBarFields.jsx`, and every style they wear comes from one
`barLook(roomy)`. The forms are in the hook rather than in the fields because they
outlive them: switching tabs keeps a half-written element, and a graph selection
fills the relation and argument forms whichever one is on show.

`ADD_BAR_PRESETS` in `constants/tabConstants.jsx` maps a tab to `{tab,
elementType}`; `REState` hands the bar `ADD_BAR_PRESETS[tab] ?? null`, and the bar
applies it exactly when the object's *identity* changes — the same
adjust-during-render trackers the graph selection uses, and for a sharper reason:
forced every render, neither the tab buttons nor the type picker could be moved
off the preset at all. Hence frozen module constants rather than an object built
at the call site. Applied before the selection, so ctrl-selecting in an assist
tab's own graph still carries the bar to a link tab.

The tabs with no entry — the analyze ones, Review, Questions and Simulate — hand
it nothing and the bar keeps whatever it was left on. That is deliberate: there is
nothing about reading a review or running a simulation that says what the reader is
about to add, and a bar that snapped back to Element on the way past would undo
work.

**A ctrl+click chain is a whole argument, not its two ends.** The canvas
accumulates `[selected, ...ctrlArgNodes]` and draws `P5, P4, P1 → J7` under it;
`onCtrlChainSelect` hands the bar that same list, and the bar reads it the way the
chip does — last is the conclusion, the rest are the premises. It used to be
handed the newest id alone as `ctrlTo`, so the bar showed the first premise and
the last conclusion: an argument nobody had picked, sitting under a chip naming
the one they had. The relation form takes the two ends of the chain, a relation
being binary — and the graph only offers one for a chain of two anyway. The
identity rule from the preset applies here too: `REState` holds the array in
state so a re-render is not a re-apply.

**An argument can be written rather than picked.** The Argument tab's
Pick/Write switch swaps the pickers for `WrittenArgumentFields`: premises stacked
over the conclusion, `+ premise` between them. Each line has one source picker —
New judgment/principle/theory, or an element on the board, which then shows its
text read-only — so written and existing statements mix freely; a line keeps its
typed text while pointed at an element. It submits through
`handleAddNewArgument` (`useRelationActions`), which takes `{ id }` for a picked
line and adds only the new ones — not a run
of `onAddElement` calls — one round, one log entry, one undo, and ids numbered
against the whole element list, since the bar's `linkableElements` leaves out
`possible` ones whose ids are still taken. The tab opens on Write, which covers
both; a ctrl+click chain switches to Pick.

**Narrow has no strip.** An add bar and a column of suggestions do not both fit on
a phone, so `GraphPanel` puts `MobileAddButton` — the text tab's floating + — in
the corner of an assist tab's body, carrying the same preset; the bar comes up as
a `roomy` sheet over the tab. Gated on `ASSIST_TABS.includes(tab)` rather than
`isAssistPanel`, which also covers Simulate: the one assist-side tab with nothing
to add to.

The bar's own height is dragged and stored once (`hooks/useAddBarSize.js`), which
used to be an arrangement between two components reading one key and is now simply
the one bar's height. It starts at `ADD_BAR_MIN_HEIGHT`. `PremisePickers` in
`user_edits/addPanelPrimitives.jsx` still stands apart from the argument tab that
uses it: every premise is a cell of the same width, which is what makes a run of
them long enough to wrap come down in columns; and the run belongs to the row that
holds the conclusion, not to a box of its own, since a box could only wrap inside
itself.

`useIsWide()` — the app's one definition of the wide layout — is what `REState` and
`GraphPanel` both ask, rather than each re-deriving it; the bar itself takes
`roomy` as a prop, since what makes it roomy is the sheet hosting it rather than
the window.

**The tour's column** — `tour/tourWidth.js`, and the one of the three that is a
*module-level store* rather than a hook's own state, for the reason `useTheme`
is one: the tour draws itself at this width and `REState` pads the app by it,
and those two are nowhere near each other in the tree. A column at 520 with the
app making room for 460 sits over the controls it is pointing at. `TOUR_W` in
`tourZ.js` is now only the width it opens at.

Two things the store carries besides the number. `setTourResizing` is read by the
app's eased `padding-left`, which is right for a tour appearing and wrong for one
being dragged — the column would follow the pointer with the app a third of a
second behind it. And `width` is in `measureRing`'s dependencies in
`tour/useTourRing.js` although nothing there reads it: the app is padded by the
column, so dragging its edge moves everything the spotlight is drawn around.

**Only the column.** The narrow layout's sheet keeps its two heights and its
grabber — `TOUR_SHEET` in `tourZ.js` — because the graph beside it reflows to
whatever is left, and a free drag would have it re-fitting under a thumb that
was only trying to scroll. That is a decision, not a gap.

Both are `role="separator"` splitters with `tabIndex`, arrow-key steps and
double-click to reset — a drag handle no keyboard can reach is a control half the
readers do not have. The divider reports percentages, which is the range the role
already assumes; the add bar reports pixels and so must state `aria-valuemax`
itself. The geometry is in the hooks, the hover and focus states in `index.css`
(`.split-divider`, `.resize-handle`), because those are pseudo-classes.

## Guided tour

One script, two layouts. `tour/tourSections.js` is the whole tour — an ordered
list of sections, each describing what the reader should *see* while they read
it (tab, chrome, graph framing, selection, control to ring). `tour/GuidedTour.jsx`
applies it and renders it either as a `column` down a wide screen's left edge or
as a `sheet` along a narrow one's bottom, both scroll-driven, with the app
padding itself by whichever edge it has given away (`TOUR_W`, `sheetHeight()`).
What it draws sits beside it — `TourSection`, `TourControls` (progress bar,
sheet handle, column edge) and `Spotlight`, whose rings `useTourRing` measures —
and `tourHelpers.js` drops sections the state cannot carry.

**Never fork the script.** A phone used to get a separate nine-card tour that
walked the ☰ menu and never mentioned reflective equilibrium — the one thing a
first-time visitor is there to find out. What may legitimately differ between
the widths is the *route* to a control, never the substance:

- `narrow: { … }` on a section overrides where its control lives at that width
  (`btn-undo` → `menu-undo`) and what has to be on screen to see it.
- `byLayout(wide, narrow)` covers a paragraph or title that has to name a
  different route. Both wordings sit side by side, so they cannot drift.
- `only: "narrow" | "wide"` is for the rare section describing something the
  other width does not have. There is exactly one today (`narrow-menu`).

`tourSections.test.js` holds both layouts to the same chapters and the same
paragraph counts, so dropping a paragraph rather than rewording it fails.

**A section that shows something on the canvas names the tab it is read on.**
`forLayout` fills `tab: "graph"` in for any section carrying `focus`, `select`,
`argument` or `quote` and not naming one itself, so the rule cannot be forgotten
on a new section. Trusting the tab the tour happens to open over works only from
the home page's Tutorial button, where the app lands on the graph; from the ?
button — or scrolling backwards out of the Assist chapter, which does change
tabs — the graph chapters were being read against an Assist panel, describing
nodes that were nowhere on screen. An explicit `tab` still wins, which is what
lets the narrow layout read the text section on its own tab.

**A section's `focus` is framed against the canvas it actually has.**
`focusFraming(dims)` in `utils/graphHelpers.js` derives the padding and the zoom
cap from the shorter axis, because the 200px margin and the 1.5× cap that were
written for a desktop canvas both break on the phone's graph strip — a couple of
hundred pixels tall, once the tour's sheet has the bottom of the screen. `fitView`
now also refuses to spend more than half an axis on margins and floors the zoom
at `usePan`'s own `ZOOM_MIN`: `extent - padding` reaching zero drew nothing, and
going negative mirrored the graph and blew it up to several times the strip.
`resetView` takes what it is handed without clamping, so the clamp has to be here.

**The AI chapter stops at one Assist tab and not at the other five.** The cycle
section names the iteration's phases — and is pinned to `WORKFLOW_NEXT_PHASE`'s
order, so a new phase that never reaches the tour fails a test — while Review
gets a section of its own, being the one a reader misreads without one: it is
not a phase of the iteration at all. It rings `tab-processReview`, which is why
the narrow menu's Assist entries carry the same `data-tutorial` ids the wide tab
bar gives them.

Theories had a section here too and it was dropped deliberately. The two things
a reader has to know about a suggestion — that a theory is proposed for reasons
that do not run through their own position, and that a Crossref verdict claims
much less than it looks like it claims — are worded on the tab itself, beside
the references they are about, and pinned by `TheorySuggestTab.test.jsx`. A tour
card would have said them once, minutes before the reader first sees one.

## LLM integration

- LLM response must include a fenced ` ```re-state ``` ` block; parser extracts it
- Coherence checker interface: `check(state) → { tensions, orphans, clusters, warnings }`
- Mock adapter: static scripts, keyword triggers, deliberate error injection
