# backend/ — Phase 2 FastAPI Backend

Python FastAPI server. Start/stop via `make start` / `make stop`.

## Key files
- `main.py` — FastAPI entry point
- `routers/` — judgments, principles, relations, arguments, review, theories, merge, conversations, simulate_rethon, llm
  (`merge` pairs elements of merged processes; the process record is sent with
  the request, since it is not part of `REState`)
- `services/llm.py` — LLM service layer
- `services/crossref.py` — reference checking for the theories router
- `models/re_state.py` — Pydantic state schema

## Notes
- **Host-agnostic by design.** The server is the image `Dockerfile` builds plus
  environment variables; nothing in the code knows which platform runs it.
  `DEPLOYMENT=hosted` picks the safe posture, `CORS_ORIGINS` names the site
  allowed to call it (empty when one host serves both and routes `/api` here),
  and `TRUSTED_PROXY_HOPS` says how many proxies append to `X-Forwarded-For` —
  without it every visitor behind a proxy shares one rate-limit allowance.
  `docker-compose.yml` runs the pair behind one host; the CI workflows hold a
  worked example of a container host, read from repository variables. Keep new
  platform specifics in those files rather than in `backend/`.
- **The server writes nothing to disk, and that is a property to keep.** There
  was a `/api/sessions` router storing RE states as Markdown files under a
  configured directory, gated on `SESSIONS_ENABLED`; it was removed rather than
  left switched off, because a gate is one setting away from holding strangers'
  moral reasoning on a shared machine. The browser keeps the working state
  (`localStorage`, offered back as "Continue where you left off") and Markdown
  export is the way out of it. `test_deployment_mode.py` pins the absence — a
  404 on every `/api/sessions` verb — and `PrivacyModal.jsx` tells the reader
  "Nothing on disk" unconditionally, which only stays true while this holds.
- API key lives server-side only (replaces `dangerouslyAllowBrowser` in the frontend)
- `services/crossref.py` is the one place this server calls a third party that is
  not an LLM provider. Three properties are deliberate and each has a test:
  **it never raises** (verification decorates a suggestion and must not be able to
  fail one, so an outage returns every reference as `unchecked`); **`not_found`
  and `unchecked` stay distinct** ("we could not look" is not "we looked and
  found nothing"); and **Crossref's relevance score is not thresholded** — it is
  an unnormalised Lucene score, so the score decides only the tie test Crossref
  itself recommends, and confirmation is our own title/author/year check.
- `CROSSREF_MAILTO` is the *operator's* address for Crossref's polite pool, set
  in `.env` and empty by default. Never populate it from whoever is using the app.
- **The server process never loads the rethon stack** (rethon, theodias,
  numba, llvmlite, numpy, pandas, …). It was most of what a cold instance read
  before it could answer — 263 MB of native libraries, about 25 s on Cloud Run
  — and the server never computes with it: every simulation and score runs in a
  worker (`process_pool.py`). So the router imports `services/rethon_tasks.py`
  (validation, `SimulationFinished`, and stand-ins for the worker entry points
  that import the real computation only inside a worker), never
  `rethon_simulation` or `rethon_scoring`. `test_startup_imports.py` fails if
  `import backend.main` loads any of it again.
- **The workers are warmed from the start page** (`POST
  /api/simulate_rethon/warm`, `warm_pool`), inside a request on purpose:
  request-based billing gives an instance CPU only while a request is open.
- `import rethon` configures logging with `disable_existing_loggers` at its
  default, switching off every logger that exists at that moment. Since rethon
  is no longer imported at a fixed point in the server, the repair travels with
  the import: `services/rethon_import.py` imports rethon and re-enables the
  `backend` tree, and every module using rethon imports it first.
- `make measure-startup` (`backend/tools/measure_startup.py`) reports what
  `import backend.main` loads and how long the server, the warm-up and the
  first computations take. Compare the bytes across a change; times only on one
  machine.
- Target LLMs: Qwen3 30B quantized (consumer GPU), DeepSeek-V3.2 / GPT-OSS-120B (high-end)
