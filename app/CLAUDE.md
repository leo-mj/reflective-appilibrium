# app/ — Phase 2 Frontend

React SPA (Vite). `LLM_ENABLED` flag gates AI features; `VITE_USE_DUMMY` enables mock data.

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

Colorblind-safe palette (all colors in `C` in `src/constants/colors.js`):

- Edges: teal (supports), orange (conflicts), amber (undermines), grey (depends)
- Nodes: blue (judgments), purple (principles), amber (theories) — shaded by confidence
- Withdrawn: grey at 25% opacity

Tabs: Graph (D3 force-directed), Text, History (slider, 3.2s/round). Node positions stable via shared force simulation on all elements including withdrawn.

## LLM integration

- LLM response must include a fenced ` ```re-state ``` ` block; parser extracts it
- Coherence checker interface: `check(state) → { tensions, orphans, clusters, warnings }`
- Mock adapter: static scripts, keyword triggers, deliberate error injection
