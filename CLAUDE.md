# Assistive Equilibrium

## What this is

A structured tool for conducting wide reflective equilibrium (RE) in ethics. It helps users iteratively build coherent moral positions by working between moral judgments, principles, and background theories. This is a research project exploring how far LLMs can assist in RE processes — the tool is not a standalone moral reasoner.

## Project phases

### Phase 1 — Claude Skill (current, working)
The project runs as a Claude Skill inside Claude Projects. The user pastes the skill prompt into project instructions and uploads the viz component and relations reference to project knowledge.

### Phase 2 — Standalone web app (planned)
A React SPA (Vite) with:
- Split-panel UI: chat on the left, persistent D3 graph on the right
- Configurable LLM backend: Anthropic API, OpenAI-compatible (Ollama, vLLM), or mock adapter
- Response parser that splits LLM output into display text + JSON state block
- Schema validator with retry loop (re-prompts the LLM on malformed output, max 3 retries)
- Pluggable coherence checker (implements a CoherenceChecker interface)
- State persistence via IndexedDB
- Downloadable HTML report of the full RE process

## Key files

### skill/ (Phase 1)
- `re-skill-prompt.md` — System prompt defining the RE facilitation process. Paste into Claude Project instructions.
- `re-viz-component.jsx` — React+D3 visualization component. Upload to project knowledge. When generating the state artifact, use this component verbatim and only replace the SAMPLE_STATE data object.
- `re-relations-reference.md` — Relation matrix defining all possible relations between element types (supports, conflicts, undermines, depends) across all element-type pairings. Upload to project knowledge.

### app/ (Phase 2, planned)
```
app/src/
  components/     — ChatPanel, GraphPanel, HistoryTab, TextTab, Legend
  logic/          — messageHandler, responseParser, schemaValidator, stateStore
  coherence/      — interface, defaultChecker
  adapters/       — anthropic, openai, mock, index (factory)
  config/         — systemPrompt loader, defaults
  report/         — generateReport (HTML export)
```

## RE domain model

### Element types
- **Judgments (J)** — Moral verdicts at any level of generality. Low credence threshold for inclusion. Circles in the visualization.
- **Principles (P)** — General moral rules that systematize judgments. Rounded rectangles in the visualization.
- **Background Theories (T)** — Broader empirical/philosophical/meta-ethical commitments. Only introduced from Round 5 onward, narrowly scoped to the topic. Diamonds in the visualization.

### Relation types
- **Supports** — A provides positive reason for B
- **Conflicts** — A and B are incompatible
- **Undermines** — A weakens B without flat contradiction
- **Depends** — A presupposes B

Relations are directional. A single pair can have multiple relations. Check both directions. See re-relations-reference.md for the full matrix with examples.

### State schema
Every element must include `addedRound`. Revised elements include `previousText` and `revisedRound`. Withdrawn elements include `reason` and `withdrawnRound`. Relations also include `addedRound`.

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

- Colorblind-safe palette: no red-green distinctions
  - Edges: teal (supports), orange (conflicts), amber/yellow (undermines), grey (depends)
  - Judgments: blue shades by confidence
  - Principles: purple shades by confidence
  - Theories: amber shades by confidence
  - Withdrawn: grey at 25% opacity
- All colors defined in the `C` object at the top of re-viz-component.jsx
- Three tabs: Graph (D3 force-directed), Text (structured plain text), History (round-by-round playback with slider)
- "Show withdrawn" toggle reveals withdrawn elements and their edges at reduced opacity
- Node positions are stable across tabs and toggle states (shared force simulation on all elements including withdrawn)
- History tab has hover tooltips, smooth slider animation (requestAnimationFrame easing), 3.2s per round playback

## Skill behavior rules (key ones for context)

- Claude never imposes moral views — presents options, user decides
- Standard rounds: register elements silently, suggest candidate principles, don't raise tensions
- Review rounds (every 5th round or on request): full coherence report, adjustment proposals, visualization update
- Never repeat back user input — acknowledge minimally ("J3, moderate.")
- Maintain holistic focus across the full topic, don't fixate on last input
- Track relations exhaustively using the relation matrix against every existing element
- Background theories deferred to Round 5+
- Number multiple questions per turn
- 2-4 candidate principles suggested each round from different ethical traditions

## Development notes

- The viz component is designed to be written once and only have SAMPLE_STATE swapped on updates — this saves output tokens
- For the standalone app, the LLM response must include a fenced JSON block (```re-state ... ```) that the parser extracts
- The coherence checker implements a CoherenceChecker interface: check(state) → { tensions, orphans, clusters, warnings }
- Mock adapter planned for testing without LLM API (static scripts, keyword triggers, state-aware generation, deliberate error injection)
- Target LLMs for local use: GPT-OSS-20B (consumer GPU), Qwen3 30B quantized, GPT-OSS-120B or DeepSeek-V3.2 (high-end GPU)