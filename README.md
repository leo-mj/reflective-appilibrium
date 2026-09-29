# reflective-appilibrium

A structured tool for conducting [reflective equilibrium (RE)](https://plato.stanford.edu/entries/reflective-equilibrium/) in ethics — iteratively building coherent moral positions by working between judgments, principles, and background theories. The aim of this tool is not to be a standalone moral reasoner.
It is part of a research project exploring in how far LLMs can assist in RE processes. It might also be useful as a tool assisting exercises in class.

## Two versions

The app ships in two configurations. Both are the same React SPA — the demo is not a reduced build, it is the full interface with the AI and simulation features switched off and replaced by pre-set examples.

- **Demo version** — a static site. No server, no API key, nothing leaves the browser. Published at <https://leo-mj.github.io/reflective-appilibrium/>.
- **Backend version** — the SPA plus a FastAPI server that provides LLM access and the rethon RE simulation. The server keeps nothing: your work stays in the browser and leaves it as a Markdown export. See below for running it locally.

| Capability                                                                                  | Demo                   | Backend  |
| ------------------------------------------------------------------------------------------- | ---------------------- | -------- |
| Graph, Text, History and Clusters tabs; manual editing of elements, relations and arguments | ✓                      | ✓        |
| Markdown import / export (with the graph embedded as SVG)                                   | ✓                      | ✓        |
| Questionnaire mode — guided RE from a pre-populated argument graph                          | ✓²                     | ✓²       |
| Guided tour and tutorial overlays                                                           | ✓                      | ✓        |
| Assist tabs (Judgments, Principles, Theories, Arguments, Relations, Review; Merge after a merge) | pre-set examples only¹ | live LLM |
| Discuss panel — follow-up conversation about a suggestion                                   | ✗                      | ✓        |
| Simulate tab — formal rethon RE process and equilibrium scores                              | ✗                      | ✓        |
| Equilibrium scores in the Text tab (per round, per withdrawal)                              | ✗                      | ✓        |
| LLM settings — provider, model, bring-your-own-key                                          | ✗                      | ✓        |

¹ In the demo, the Assist tabs return pre-set example suggestions when you are working on the sample process, and are disabled on a process of your own. A banner at the top of the app says so.

² Only with a questionnaire spec in `app/src/questionnaires/`, which is gitignored: a build from a fresh checkout has none, and the home page then shows no questionnaire cards.

Neither version stores anything on a server. Both autosave the working state to the browser, and both export the full state to Markdown to re-import later.

## Demo version

Nothing to install — open <https://leo-mj.github.io/reflective-appilibrium/>.

To build and preview it yourself:

```bash
cd app
npm install
npm run build
npm run preview
```

The demo build is served from `/reflective-appilibrium/`, so the preview is at `http://localhost:4173/reflective-appilibrium/`. Set `VITE_BASE_PATH=/` at build time to serve it from the root instead (see [app/vite-plugins/basePath.js](app/vite-plugins/basePath.js)).

## Backend version

The FastAPI backend exposes the LLM endpoints and the rethon simulation. It must be running for the Assist tabs, the Discuss panel and the Simulate tab to work.

### Prerequisites

- Python 3.12 (what CI and the Docker image use)
- Node 24 (what CI uses)
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
```

To run against a local model only (e.g. Ollama) — local mode only, since the backend makes the call and a hosted server's `localhost` is the server itself; `DEPLOYMENT=hosted` refuses the URL and the settings modal stops offering it:

```env
LLM_API_KEYS={"http://localhost:11434/v1":"ollama"}
DEFAULT_MODEL=qwen3:30b
CORS_ORIGINS=http://localhost:5173
```

**Bring-your-own-key (BYOK):** users can also enter an API key directly in the LLM settings modal in the browser. It is held in `sessionStorage`, sent as an `x-api-key` header, and never stored server-side. Server-side keys are only served to localhost — remote browsers must supply their own key.

Every other setting is documented in [backend/.env.example](backend/.env.example). The one to know about is `DEPLOYMENT`: leave it at `local` only while uvicorn and the browser are on the same machine. Anything else — a LAN, a tunnel, a container behind a proxy — is `hosted`, which stops lending server-side keys and turns on rate limits, timeouts and limits on how large a rethon computation may be (see [What a hosted instance computes](#what-a-hosted-instance-computes)).

`APP_ACCESS_TOKENS` is for API clients, not the web app: the site never sends the `x-app-token` header it checks, so setting it on an instance the site uses locks the site out of every route but `/api/health`. Leave it empty behind the web app, as the published deployment does.

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

The API is then available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs` — local only; a `hosted` instance answers 404 there.

### 5. Start the frontend

```bash
cd app
npm install
echo "VITE_APP_ENV=dev" > .env   # once; app/.env is gitignored
npm run dev
```

The app runs at `http://localhost:5173` with all backend features enabled, calling the backend at `http://localhost:8000`. Without `VITE_APP_ENV=dev` in `app/.env` the dev server runs with the backend features switched off, as in the demo.

### Or with Docker

`docker compose up --build` from the repo root runs the backend and a frontend container that serves the app and forwards `/api` to it, at `http://localhost:8080`. The backend runs `hosted` there, so it lends no server-side keys: enter your own in the LLM settings modal.

### Where your work lives

The working state is written to the browser's `localStorage` as you go, and the
home page offers it back under "Continue where you left off". That is the only
persistence there is: the server has no endpoint that writes to disk, so nothing
of anyone's reasoning is stored on it. Export to Markdown for anything that
needs to outlive a browser profile.

See [app/README.md](app/README.md) for the full build-target and feature-flag tables.

### rethon simulation

The backend integrates the computational model of RE from [rethon](https://re-models.github.io/rethon/). An LLM detects arguments among the existing elements and suggests additional premises; the Simulate tab then runs the full rethon RE process, stepping through commitment/theory evolution and visualising equilibrium scores.

See:

Beisbart, Claus; Betz, Gregor & Brun, Georg (2021). Making Reflective Equlibrium Precise: A Formal Model. Ergo: An Open Access Journal of Philosophy 8:441–472.
Freivogel, Andreas & Cacean, Sebastian (2024). Assessing a Formal Model of Reflective Equilibrium.

#### What a hosted instance computes

A rethon computation's cost grows about 1.6 times with every element that takes
part in an argument, and faster still with the depth of its search. On a shared
server one large request holds up every other visitor's, so `DEPLOYMENT=hosted`
limits what one request may ask for. A local instance limits nothing.

| Limit | Hosted | Setting |
| --- | --- | --- |
| Elements that take part in arguments | 20 | `MAX_ARGUED_ELEMENTS` |
| Elements in all | 50 | `MAX_SIMULATION_ELEMENTS` |
| Search depth of a simulation | 2 | `MAX_NEIGHBOURHOOD_DEPTH` |
| Time one computation may run | 60 s | `SIMULATION_TIMEOUT_SECONDS` |

- **Argued elements are what cost.** An element no argument mentions adds almost
  nothing, so the tight cap counts only those; the demo is 22 elements with 10
  in arguments. Every argument counts, single-premise and withdrawn ones too:
  a withdrawn argument stays in the computation, so a withdrawn element can
  still turn out to make the position more coherent.
- **The depth is fixed on a hosted instance.** The Simulate tab reads the limit
  from `/api/health` and always searches at it, showing "Depth 2" in place of a
  choice: depth 3 costs about ten times depth 2, and took the demo merged with
  its second process past the time limit. Locally the tab offers depths 1–4.
- **A request over a limit is refused with a message saying which** (422), and
  one that runs out of time with a 504. Set any of the settings to `0` to lift
  that limit on a hosted instance; the measurements behind each number are in
  [backend/config.py](backend/config.py).

## Tests

```bash
pytest backend/          # backend, from the repo root
cd app && npm test       # frontend unit tests (Vitest)
cd app && npm run test:e2e   # browser tests (Playwright), see app/e2e/README.md
```

---

## License

MIT
