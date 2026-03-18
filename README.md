# assistive-equilibrium

A structured tool for conducting reflective equilibrium (RE) in ethics — iteratively building coherent moral positions by working between judgments, principles, and background theories. The aim of this tool is not to be a standalone moral reasoner. 
It is part of a research project exploring in how far LLMs can assist in RE processes.

## Current Status

**Phase 1 — Claude Skill (working)**
The project currently runs as a Claude Skill inside Claude Projects. See `skill/` for the prompt and knowledge files.

**Phase 2 — Standalone Web App (planned)**
A React SPA with LLM API integration, persistent visualization, pluggable coherence checking, and support for local open-source models.

## Quick Start (Phase 1 — Claude Skill)

1. Create a new Project in [claude.ai](https://claude.ai)
2. Paste the contents of `skill/re-skill-prompt.md` into the project instructions
3. Upload `skill/re-viz-component.jsx` and `skill/re-relations-reference.md` to project knowledge
4. Start a conversation within the project

---

## Quick Start (Phase 2 — Web App, planned)

```bash
cd app
npm install
npm run dev
```

Configure your LLM backend in the settings panel.

---

## License

MIT