# reflective-appilibrium

A structured tool for conducting [reflective equilibrium (RE)](https://plato.stanford.edu/entries/reflective-equilibrium/) in ethics — iteratively building coherent moral positions by working between judgments, principles, and background theories. The aim of this tool is not to be a standalone moral reasoner.
It is part of a research project exploring in how far LLMs can assist in RE processes. It might also be useful as a tool assisting exercises in class.

## Two versions

The app ships in two configurations. Both are the same React SPA — the demo is not a reduced build, it is the full interface with the AI and simulation features switched off and replaced by pre-set examples.

- **Demo version** — a static site. No server, no API key, nothing leaves the browser. Live at <https://leo-mj.github.io/reflective-appilibrium/>.
- **Backend version** — the SPA plus a FastAPI server that provides LLM access, session storage, and the rethon RE simulation. Run it locally or deploy the backend yourself.

| Capability                                                                                  | Demo                   | Backend  |
| ------------------------------------------------------------------------------------------- | ---------------------- | -------- |
| Graph, Text, History and Clusters tabs; manual editing of elements, relations and arguments | ✓                      | ✓        |
| Markdown import / export (with the graph embedded as SVG)                                   | ✓                      | ✓        |
| Questionnaire mode — guided RE from a pre-populated argument graph                          | ✓                      | ✓        |
| Guided tour and tutorial overlays                                                           | ✓                      | ✓        |
| Assist tabs (Judgments, Principles, Arguments, Relations)                                   | pre-set examples only¹ | live LLM |
| Discuss panel — follow-up conversation about a suggestion                                   | ✗                      | ✓        |
| Simulate tab — formal rethon RE process and equilibrium scores                              | ✗                      | ✓        |
| Equilibrium scores in the Text tab (per round, per withdrawal)                              | ✗                      | ✓        |
| Saving and reloading sessions on the server                                                 | ✗²                     | ✓        |
| LLM settings — provider, model, bring-your-own-key                                          | ✗                      | ✓        |

¹ In the demo, the Assist tabs return pre-set example suggestions when you are working on the sample process, and are disabled on a process of your own. A banner at the top of the app says so.
² The demo can still export the full state to Markdown and re-import it later.

The relatedness-matrix tab is currently switched off in both versions (`MATRIX_ENABLED` in [app/src/config.js](app/src/config.js)).

## Demo version

Nothing to install — open <https://leo-mj.github.io/reflective-appilibrium/>.

To build it yourself:

```bash
cd app
npm install
npm run build
```

Deploy the resulting `dist/` folder to any static host. Note that the production build sets a base path of `/reflective-appilibrium/` (see [app/vite.config.js](app/vite.config.js)); change it if you deploy at a different path.

## Backend version

The FastAPI backend exposes the LLM endpoints, session persistence, and the rethon simulation. It must be running for the Assist tabs, the Discuss panel, the Simulate tab and session storage to work.

### Prerequisites

- Python 3.10+
- Node 20+
- An API key for at least one provider — OpenAI, Anthropic, Mistral, or an OpenAI-compatible local endpoint (Ollama, vLLM)

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

# Where RE sessions are stored. Defaults to <repo-root>/sessions.
# SESSIONS_DIR=/var/data/reflective-appilibrium/sessions
```

To run against a local model only (e.g. Ollama):

```env
LLM_API_KEYS={"http://localhost:11434/v1":"ollama"}
DEFAULT_MODEL=qwen3:30b
CORS_ORIGINS=http://localhost:5173
```

**Bring-your-own-key (BYOK):** users can also enter an API key directly in the LLM settings modal in the browser. It is held in `sessionStorage`, sent as an `x-api-key` header, and never stored server-side. Server-side keys are only served to localhost — remote browsers must supply their own key.

### 4. Start / stop the backend

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

### 5. Start the frontend

```bash
cd app
npm install
npm run dev
```

The app runs at `http://localhost:5173` with all backend features enabled.

### Deploying the backend version

Set `DEPLOYMENT=hosted` in `backend/.env`. Whether anyone but you can reach the
server cannot be detected at runtime — behind a reverse proxy `request.client` is
the proxy, not the caller — so it is declared, and three protections follow:

| | `local` (default) | `hosted` |
| --- | --- | --- |
| Server-side API keys | lent to callers on localhost | never; every user brings their own |
| Rate limit | none | 60/min per caller, separately for LLM calls and simulations |
| Session storage | on, to disk under `SESSIONS_DIR` | off; the browser keeps the working state |

"Local" means uvicorn and the browser on the same machine. A LAN, a tunnel, a VPS
or a container behind nginx is `hosted`. Each protection can still be set
individually to depart from the mode — see `backend/.env.example`.

On a hosted instance you should also set **`APP_ACCESS_TOKENS`**, a
comma-separated list. Without it the API is open to anyone who can reach the
port. Issue **one token per participant** for a class or study: the rate limiter
buckets by whichever token matched, so distinct tokens give each person their own
allowance, whereas a single shared token puts a whole seminar room into one.

The rate limiter, the session store and the discussion sessions all live in one
process, so run **one** uvicorn worker unless you replace them with a shared store.

### Where a session lives

The working state is written to the browser's `localStorage` as you go, and the
home page offers it back under "Continue where you left off". That is the only
persistence a `hosted` instance provides — nothing of a participant's reasoning
is written to the server — so encourage exporting to Markdown for anything that
needs to outlive a browser profile.

Then build the frontend:

```bash
cd app
npm run build:backend
```

This needs an `app/.env.backend` file:

```env
VITE_APP_ENV=backend
VITE_BACKEND_URL=https://<your-deployed-backend>
```

See [app/README.md](app/README.md) for the full build-target and feature-flag tables.

### rethon simulation

The backend integrates the computational model of RE from [rethon](https://re-models.github.io/rethon/). An LLM detects arguments among the existing elements and suggests additional premises; the Simulate tab then runs the full rethon RE process, stepping through commitment/theory evolution and visualising equilibrium scores.

See:

Beisbart, Claus; Betz, Gregor & Brun, Georg (2021). Making Reflective Equlibrium Precise: A Formal Model. Ergo: An Open Access Journal of Philosophy 8:441–472.
Freivogel, Andreas & Cacean, Sebastian (2024). Assessing a Formal Model of Reflective Equilibrium.

## Tests

```bash
pytest backend/      # backend
cd app && npm test   # frontend
```

---

## License

MIT
