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

## Quick Start (Phase 2 — Frontend Web App)

```bash
cd app
npm install
npm run dev
```

## Backend Setup (Phase 2)

The FastAPI backend exposes LLM endpoints and session persistence. It must be running for AI features in the frontend to work.

### Prerequisites

- Python 3.10+
- An OpenAI-compatible API key (OpenAI, local Ollama/vLLM, etc.)

### 1. Create and activate a virtual environment

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Create `backend/.env` (gitignored):

```env
OPENAI_API_KEY=your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1   # or a local endpoint
OPENAI_MODEL=gpt-4o-mini
```

To run against a local model (e.g. Ollama):

```env
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=qwen3:30b
```

### 4. Start / stop

From the **repo root**:

```bash
make start   # starts uvicorn with --reload in the background
make stop    # kills the background process
```

Or run directly:

```bash
uvicorn backend.main:app --reload
```

The API is then available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

---

## License

MIT
