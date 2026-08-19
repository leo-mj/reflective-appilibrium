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
- `src/components/workflows/` — JudgmentElicitTab, PrincipleSuggestTab, RelationSuggestTab, QuestionnaireTab
- `src/utils/` — LLM client, workflow utilities, state utilities
- `src/state.js`, `types.js`, `config.js` — app state and config
- `src/constants/colors.js` — `C` object with all viz colors

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
to AA; a button is not.

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

## LLM integration

- LLM response must include a fenced ` ```re-state ``` ` block; parser extracts it
- Coherence checker interface: `check(state) → { tensions, orphans, clusters, warnings }`
- Mock adapter: static scripts, keyword triggers, deliberate error injection
