# Assistive Equilibrium

A structured tool for wide reflective equilibrium (RE) in ethics. Research project exploring how far LLMs can assist RE processes.

## Project phases

**Phase 1 — Claude Skill** (working): Skill prompt + viz component run inside Claude Projects.
**Phase 2 — Standalone web app** (in progress): React SPA (Vite) + FastAPI backend. Split-panel UI: chat left, D3 graph right. Configurable LLM backend (Anthropic, OpenAI-compatible, mock). Response parser extracts fenced `re-state` JSON block; schema validator retries up to 3 times. State via IndexedDB. HTML report export.

## Key files

### skill/ (Phase 1)
- `re-skill-prompt.md` — System prompt. Paste into Claude Project instructions.
- `re-viz-component.jsx` — React+D3 viz. Upload to project knowledge. Only swap `SAMPLE_STATE`.
- `re-relations-reference.md` — Full relation matrix with examples.

### app/src/ (Phase 2)
- `components/` — UI panels and tabs
- `utils/` — LLM client, workflow utilities
- `state.js`, `types.js`, `config.js` — app state and config
- `App.jsx` — root component

### backend/ (Phase 2)
- `main.py` — FastAPI entry point
- `routers/` — endpoints: judgments, principles, relations, matrix, llm
- `services/llm.py` — LLM service layer
- `models/re_state.py` — Pydantic state schema

## RE domain model

### Element types
- **Judgments (J)** — Moral verdicts, any generality level. Circles in viz.
- **Principles (P)** — General moral rules. Rounded rectangles in viz.
- **Background Theories (T)** — Broader meta-ethical commitments. Diamonds in viz. Deferred to Round 5+.

### Relation types
- **Supports** — A provides positive reason for B
- **Conflicts** — A and B are incompatible
- **Undermines** — A weakens B without flat contradiction
- **Depends** — A presupposes B

Relations are directional; a single pair can have multiple. See `skill/re-relations-reference.md` for the full matrix.

### State schema

```javascript
{
  topic: String,
  phase: Number,
  round: Number,
  elements: [{ id, type, status, confidence, origin, text, addedRound, ?previousText, ?revisedRound, ?reason, ?withdrawnRound }],
  relations: [{ from, to, type, explanation, addedRound }],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [{ round, findings, options, decision, changes }]
}
```

## Visualization conventions

- Colorblind-safe palette — all colors defined in the `C` object at the top of `re-viz-component.jsx`:
  - Edges: teal (supports), orange (conflicts), amber (undermines), grey (depends)
  - Nodes: blue (judgments), purple (principles), amber (theories) — shaded by confidence
  - Withdrawn: grey at 25% opacity
- Tabs: Graph (D3 force-directed), Text, History (slider playback, 3.2s/round)
- Node positions stable across tabs/toggle via shared force simulation on all elements including withdrawn

## Development notes

- LLM response must include a fenced ` ```re-state ``` ` block; parser extracts it
- Coherence checker interface: `check(state) → { tensions, orphans, clusters, warnings }`
- Mock adapter for testing: static scripts, keyword triggers, state-aware generation, deliberate error injection
- Target local LLMs: Qwen3 30B quantized (consumer GPU), DeepSeek-V3.2 / GPT-OSS-120B (high-end)
