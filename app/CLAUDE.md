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

## LLM integration

- LLM response must include a fenced ` ```re-state ``` ` block; parser extracts it
- Coherence checker interface: `check(state) → { tensions, orphans, clusters, warnings }`
- Mock adapter: static scripts, keyword triggers, deliberate error injection
