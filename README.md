# reflective-appilibrium

A structured tool for conducting [reflective equilibrium (RE)](https://plato.stanford.edu/entries/reflective-equilibrium/) in ethics — iteratively building coherent moral positions by working between judgments, principles, and background theories. The aim of this tool is not to be a standalone moral reasoner.
It is part of a research project exploring in how far LLMs can assist in RE processes. It might also be useful as a tool assisting exercises in class.

## Two versions

The app ships in two configurations. Both are the same React SPA — the demo is not a reduced build, it is the full interface with the AI and simulation features switched off and replaced by pre-set examples.

- **Demo version** — a static site. No server, no API key, nothing leaves the browser. Published at <https://leo-mj.github.io/reflective-appilibrium/>.
- **Backend version** — the SPA plus a FastAPI server that provides LLM access and the rethon RE simulation. The server keeps nothing: your work stays in the browser and leaves it as a Markdown export. Run it locally, or deploy it — the two halves are published separately from the demo, at whatever addresses their deployment gives them.

The two are published as **separate sites, deliberately**. The demo holds no key and makes no requests, so it is safe on a shared host; the backend version holds a visitor's API key in the browser tab, so it belongs on an address of its own rather than one shared with unrelated pages. Which host each uses is a deployment decision, not a property of the code: both builds come from this repository and are pointed at their destination by `VITE_BASE_PATH`, `VITE_BACKEND_URL` and the backend's `CORS_ORIGINS`.

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

Nothing to install — open <https://leo-mj.github.io/reflective-appilibrium/>. That address serves the demo only; the version with the AI features is deployed separately, and its address depends on where it is hosted.

To build it yourself:

```bash
cd app
npm install
npm run build
```

Deploy the resulting `dist/` folder to any static host. Note that the production build is served from `/reflective-appilibrium/` by default, the path GitHub Pages uses; set `VITE_BASE_PATH` (e.g. `/` for a site served from its root) if you deploy at a different path. See [app/vite-plugins/basePath.js](app/vite-plugins/basePath.js).

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

The API is then available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs` — local only; a `hosted` instance answers 404 there.

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
the proxy, not the caller — so it is declared, and these protections follow:

| | `local` (default) | `hosted` |
| --- | --- | --- |
| Server-side API keys | lent to callers on localhost | never; every user brings their own |
| Rate limits, per caller per minute | none | 60 LLM calls, 5 simulations, 30 steps, 300 score lookups |
| LLM call timeout | 600s (SDK default) | 90s |
| rethon computation | no size cap, no timeout | at most 20 elements, stopped after 60s |

The server writes nothing to disk in either mode — see "Where your work lives"
below.

"Local" means uvicorn and the browser on the same machine. A LAN, a tunnel, a VPS
or a container behind nginx is `hosted`. Each protection can still be set
individually to depart from the mode — see `backend/.env.example`.

On a hosted instance you should also set **`APP_ACCESS_TOKENS`**, a
comma-separated list. Without it the API is open to anyone who can reach the
port. Issue **one token per participant** for a class or study: the rate limiter
buckets by whichever token matched, so distinct tokens give each person their own
allowance, whereas a single shared token puts a whole seminar room into one.

The rate limiter lives in one process, so run **one** uvicorn worker unless you
replace it with a shared store — and, on a platform that autoscales, one
instance (`--max-instances=1` on Cloud Run).

**Behind a reverse proxy, set `TRUSTED_PROXY_HOPS`.** Without tokens the rate
limiter identifies callers by address, and a proxy's address is the same for
every visitor — so all of them share one allowance, and the caps become either
useless or a site-wide outage. Set it to the number of proxies in front that
append to `X-Forwarded-For` (1 on Cloud Run, Fly or Render); the backend then
reads the entry that proxy wrote. **Do not** start uvicorn with
`--forwarded-allow-ips="*"`: it takes the leftmost entry, which the caller
writes, so anyone can pick a fresh allowance per request. The backend logs a
warning at startup when neither tokens nor `TRUSTED_PROXY_HOPS` are set, and a
second, once per process, when a request shows a proxy it is ignoring.

### Deploying the backend to a container host — a worked example

Any host that runs a container works, and the image needs nothing from a
particular one. What follows is one example end to end, Google Cloud Run,
because a deployment is easier to adapt than to invent. The `deploy-backend` job
in `.github/workflows/ci.yml` runs it **only from the Actions tab** ("Run
workflow"), never on a push, and only after the backend tests and the image
check have passed.

Why Cloud Run: its free tier — 180,000 vCPU-seconds, 360,000 GiB-seconds and
2M requests a month, counted only while a request is being served — covers a
research tool with room to spare, and there is no server to maintain. The price
is a few seconds' cold start after an idle spell, since the service scales to
zero: the container starts, imports rethon, and the first simulation also starts
its worker process.

The one-off setup, once per Google Cloud project:

```bash
PROJECT=your-project-id          # gcloud projects create … or the console
REGION=europe-west3              # Frankfurt; any region works
REPO=appilibrium
GITHUB_REPO=leo-mj/assistive-equilibrium

gcloud config set project "$PROJECT"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
    iamcredentials.googleapis.com

# Where the image lives. The cleanup policy is what keeps storage inside the
# free half-gigabyte: without it every deploy leaves an image behind for good.
gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION"
cat > /tmp/cleanup.json <<'JSON'
[{"name": "keep-3", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 3}},
 {"name": "drop-the-rest", "action": {"type": "Delete"}, "condition": {"olderThan": "7d"}}]
JSON
gcloud artifacts repositories set-cleanup-policies "$REPO" --location="$REGION" \
    --policy=/tmp/cleanup.json

# The identity the workflow acts as.
gcloud iam service-accounts create github-deploy
SA="github-deploy@$PROJECT.iam.gserviceaccount.com"
for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$role"
done

# Workload Identity Federation: GitHub proves which repository is asking, and
# Google trusts that. No service-account key is stored in the repository, so
# there is no long-lived credential to leak. The attribute condition is what
# stops any other repository using this.
gcloud iam workload-identity-pools create github --location=global
gcloud iam workload-identity-pools providers create-oidc github \
    --location=global --workload-identity-pool=github \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='$GITHUB_REPO'"
NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
gcloud iam service-accounts add-iam-policy-binding "$SA" \
    --role=roles/iam.workloadIdentityUser \
    --member="principalSet://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GITHUB_REPO"

echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/$NUMBER/locations/global/workloadIdentityPools/github/providers/github"
```

Then set these **repository variables** (Settings → Secrets and variables →
Actions → Variables). None is secret: the workflow holds no credential.

| Variable | Value |
| --- | --- |
| `GCP_PROJECT_ID` | the project id |
| `GCP_REGION` | e.g. `europe-west3` |
| `GCP_ARTIFACT_REPO` | `appilibrium` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | printed by the last command above |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `github-deploy@<project>.iam.gserviceaccount.com` |
| `BACKEND_CORS_ORIGINS` | the frontend site's origin, `scheme://host` with no path; empty if one host serves both |

Finally, **set a budget alert** (Billing → Budgets & alerts) at an amount you
would notice, say €1. The free tier covers normal use, but a budget alert is
what tells you if that ever stops being true.

The deploy sets `DEPLOYMENT=hosted`, `TRUSTED_PROXY_HOPS=1` (Cloud Run appends
the caller's address to `X-Forwarded-For`) and `--max-instances=1`, which the
rate limiter requires. The run's summary prints the service URL — that is the
`VITE_BACKEND_URL` the frontend build needs.

### Where your work lives

The working state is written to the browser's `localStorage` as you go, and the
home page offers it back under "Continue where you left off". That is the only
persistence there is, in either deployment mode: the server has no endpoint that
writes to disk, so nothing of anyone's reasoning is stored on it. Encourage
exporting to Markdown for anything that needs to outlive a browser profile.

Then build the frontend:

```bash
cd app
npm run build:backend
```

This reads `app/.env.backend`, which is tracked and carries a placeholder for the
backend address. Supply the real one in the environment at build time, where it
takes priority over the file:

```bash
VITE_BACKEND_URL=https://<your-deployed-backend> npm run build:backend
```

A build that falls back to the placeholder logs an error at load, and every
backend request from it fails.

Two shapes of deployment, and the build says which by what it is given
(see [app/src/backendUrl.js](app/src/backendUrl.js)):

- **Backend on its own host** — `VITE_BACKEND_URL=https://…`, and the backend's
  `CORS_ORIGINS` names the site's origin. The site and the server can then be
  hosted independently of each other.
- **Both behind one host**, one proxy routing `/api` to the backend —
  `VITE_BACKEND_URL=/`, and `CORS_ORIGINS` empty, since no request crosses an
  origin. `docker-compose.yml` runs that pair; the frontend image serves the
  site and forwards `/api` itself, so a host routes one name to one container.

Nothing in the code names a hosting provider. `.github/workflows/ci.yml` carries
one worked example for each half — the demo to GitHub Pages, the backend to a
container host — and both read their destination from repository variables, so
moving either is a change of setting rather than of code.

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
