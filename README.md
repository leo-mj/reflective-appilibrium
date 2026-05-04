# reflective-appilibrium

A structured tool for conducting [reflective equilibrium (RE)](https://plato.stanford.edu/entries/reflective-equilibrium/) in ethics — iteratively building coherent moral positions by working between judgments, principles, and background theories. The aim of this tool is not to be a standalone moral reasoner.
It is part of a research project exploring in how far LLMs can assist in RE processes. It might also be useful as a tool assisting exercises in class.

## Current Status

**Phase 1 — Claude Skill (working)**
The project currently runs as a Claude Skill inside Claude Projects. See `skill/` for the prompt and knowledge files.

**Phase 2 — Standalone Web App (working)**
A React SPA backed by a FastAPI server. Features: session save/load, multi-provider LLM support (OpenAI, Mistral, Anthropic, local Ollama), bring-your-own-key (BYOK) access from the browser, light/dark mode, tutorial overlays, and a structured RE workflow with judgment elicitation, principle suggestions, and relation checking.

The React SPA also works by itself. However, only the Analyze tabs are usable while the Assist tabs' LLM features are only demoed via sample data.

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

Copy the example and fill in your values:

```bash
cp backend/.env.example backend/.env
```

`backend/.env` (gitignored):

```env
# One entry per provider you want available server-side.
# Only localhost requests can use server-side keys; remote browsers must BYOK.
LLM_API_KEYS={"https://api.openai.com/v1":"sk-...","https://api.anthropic.com/v1":"sk-ant-..."}

# Default model when the browser does not specify one.
DEFAULT_MODEL=gpt-4o-mini

# Allowed CORS origins (no wildcards).
CORS_ORIGINS=http://localhost:5173
```

To run against a local model only (e.g. Ollama):

```env
LLM_API_KEYS={"http://localhost:11434/v1":"ollama"}
DEFAULT_MODEL=qwen3:30b
CORS_ORIGINS=http://localhost:5173
```

**Bring-your-own-key (BYOK):** users can also enter an API key directly in the LLM settings modal in the browser. BYOK keys are never stored server-side.

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
