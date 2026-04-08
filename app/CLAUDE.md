# app/ — Phase 2 Frontend

React SPA (Vite). `LLM_ENABLED` flag gates AI features; `VITE_USE_DUMMY` enables mock data.

## Key files

- `src/App.jsx` — root component
- `src/components/REState.jsx` — main state management and layout
- `src/components/workflows/` — JudgmentElicitTab, PrincipleSuggestTab, RelationSuggestTab
- `src/utils/` — LLM client, workflow utilities, state utilities
- `src/state.js`, `types.js`, `config.js` — app state and config
- `src/constants/colors.js` — `C` object with all viz colors

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
