# app/ — Phase 2 Frontend

React SPA (Vite). `src/config.js` derives every feature flag from one build-time
`VITE_APP_ENV` (`dev` | `demo` | `backend`) — `LLM_ENABLED` and `BYOK_ENABLED` both
follow `BACKEND_ENABLED`. Mock data is a *runtime* choice, not a flag: the assist
panel's "use sample suggestions" checkbox passes `useDummy` down to
`llmClientFactory`, which also falls back to samples whenever `LLM_ENABLED` is false.

Tests: `npm test` (Vitest, jsdom) and `npm run test:e2e` (Playwright — see `e2e/README.md`).

## Key files

- `src/App.jsx` — root component
- `src/components/REState.jsx` — main state management and layout
- `src/components/workflows/` — JudgmentElicitTab, PrincipleSuggestTab, RelationSuggestTab, ProcessReviewTab, QuestionnaireTab
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

The accessible set is the same six hues moved into the luminance band that is
legible on both canvases *and* as type on the header chip: roughly 0.175–0.265,
which is narrow. They are deliberately not all at one luminance, since that is
the channel red-green deficiency leaves intact. What the set fixes is contrast,
not hue separation — orange, yellow and green stay confusable, and what carries
them apart is the redundancy already there: dash pattern and arrowhead.

Five places draw an edge and all five take the palette: `ArrowDefs`,
`GraphElements`, `graphRender.renderJointArgument` (a plain function, so its two
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

## Visualization conventions

Colorblind-safe palette. Two modules, and the split matters:

- `src/constants/colors.js` — everything that does **not** vary by mode: edges,
  states, surfaces, and the per-type *foreground* tones (`C.judgment.text`, …).
- `src/constants/palettes.js` — the node **fills** and the label ink, which do.

Edges: teal (supports), orange (conflicts), amber (undermines), grey (depends);
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
`TextTabAddPanel.test.jsx` pins the fill, the ink and the weight per mode, which
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

## Panels the reader sizes

Two things in the wide layout are dragged rather than styled, and both remember
where they were left (`utils/storedPref.js` — localStorage that cannot throw,
since private-mode Safari denies it outright).

**The central divider** — `hooks/useSplitRatio.js`. **The ratio is the line's
position from the left edge of the row, not a panel's share of it.** The two
modes put the flexible panel on opposite sides — analyze reads text-then-graph,
an assist tab anchors its own panel left and puts the companion right of it — so
a ratio meaning "the fixed panel's width" would jump when the reader changed
tabs. `panelWidth` goes on whichever panel carries an explicit width; the other
takes what is left with `flex: 1`.

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
page a scrollbar. `HEIGHT_CAP` is `min(75dvh, 100%)`: the window's share, and the
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
`GuidedTour.jsx` although nothing there reads it: the app is padded by the
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

**The AI chapter stops at two Assist tabs and not at the other four.** The cycle
section names the iteration's phases — and is pinned to `WORKFLOW_NEXT_PHASE`'s
order, so a new phase that never reaches the tour fails a test — while Theories
and Review get a section each, being the two a reader misreads without one: a
theory carries references whose verification state claims much less than it
looks like it claims, and Review is not a phase of the iteration at all. Both
ring `tab-<key>`, which is why the narrow menu's Assist entries carry the same
`data-tutorial` ids the wide tab bar gives them.

## LLM integration

- LLM response must include a fenced ` ```re-state ``` ` block; parser extracts it
- Coherence checker interface: `check(state) → { tensions, orphans, clusters, warnings }`
- Mock adapter: static scripts, keyword triggers, deliberate error injection
