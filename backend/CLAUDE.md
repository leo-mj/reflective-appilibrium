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
  Each worker also runs a small score or simulation (`services/rethon_warmup.py`):
  theodias's numba functions are compiled on a worker's first call, not cached,
  which cost the first real computation 1–2 s. `test_rethon_warmup.py` holds
  that the small process compiles everything a larger one needs.
- `import rethon` configures logging with `disable_existing_loggers` at its
  default, switching off every logger that exists at that moment. Since rethon
  is no longer imported at a fixed point in the server, the repair travels with
  the import: `services/rethon_import.py` imports rethon and calls
  `configure_backend_logging` again, and every module using rethon imports it
  first. The same call gives `uvicorn` and `uvicorn.error` our handler —
  uvicorn's own would quote exception messages — and keeps `uvicorn.access`
  off, so the server needs it with rethon gone too: `main.py` calls it on
  import. Python warnings go through it as well (`py.warnings`), so a JSON
  collector gets them as one entry.
- **The server logs one line as it stops** (`activity.py`, from `main.lifespan`):
  uptime, requests served and how long since the last. A hosted instance is
  stopped some while after its last request — Cloud Run sends SIGTERM first,
  which uvicorn receives because the image `exec`s it — and how long it
  survives idle is not a documented constant, so this is where it is read off.
  Counts and times only.
- `make measure-startup` (`backend/tools/measure_startup.py`) reports what
  `import backend.main` loads and how long the server, the warm-up and the
  first computations take. Compare the bytes across a change; times only on one
  machine.
- **Logs never quote content.** `ContentFreeFormatter` prints a traceback's
  frames and exception types but no message, since messages quote input;
  `test_log_privacy.py` holds every path to that. `LOG_FORMAT=json` (set on
  Cloud Run by `deploy-backend`) writes one JSON object per line, with
  `severity`, and `request_id` — the trace id the platform's proxy gave the
  request, so a line can be found from the request log, or a fresh one.
- **No visitor addresses are kept.** The rate limiter holds one in memory for
  its minute, and no log line names one; the deployed service also excludes
  Cloud Run's request log (`deploy-backend` setup in `ci.yml`). Usage is
  counted instead by `/api/health?session=1`, which the app's health check
  asks for until the server first answers — once per page load — and which
  writes an identifier-free line to `backend.sessions`.
- Target LLMs: Qwen3 30B quantized (consumer GPU), DeepSeek-V3.2 / GPT-OSS-120B (high-end)
- **The argument checker tags; it does not reject.** An argument that fails
  (`verify_and_partition` in `services/arguments.py`) is surfaced as proposed,
  its meaning postulates among its premises, with a code and a reason worded
  for the reader (`CHECK_FAILURES`, `argument_failures` in the response,
  parallel to `num_arguments`); the Arguments tab lists it below the passing
  ones, under a heading of its own, and accepting it writes the reason into
  the relation's explanation. Folding a postulate into
  "Valid given" and auto-trimming are what passing earns. Only a proposal with
  nothing to show is dropped — citing an index nothing defines, or no premise
  (`dropped_count`). An added premise worded as an existing sentence is read as
  that sentence first, in either mode (`identify_repeated_premises`).
  **A bridge that only restates the inference** — "If <premises>, then
  <conclusion>" — is taken as the model tags it, and a postulate is folded
  into "Valid given" like any other. Two alternatives were tried and dropped:
  failing the argument threw away conditionals that are plausible, or worth
  defending in a later round; surfacing every one as a premise made the
  analytic ones — a conclusion following from a premise by what its words
  mean — into near-duplicate elements, which the folding exists to avoid. The
  wording cannot tell those two kinds apart; the role is the model's claim
  about which it is. The prompt asks it not to write them, so they do not
  crowd the suggestions, and a folded one still shows on the card before the
  reader accepts the argument.
- **The prompt spells out the bookkeeping the checker tests** (`build_prompt`)
  — each postulate's form is the bridge from its argument's other indices to
  the conclusion — and asks the model to check every argument against it before
  answering; `test_the_prompt_example_passes_the_checker` holds the prompt's
  own example to it. To see what a prompt change does,
  `python -m backend.scripts.eval_argument_prompt export.md --base-url … --model …`
  (key in `LLM_API_KEY`) runs detection on an exported process and tallies the
  proposals as passed, failed (by reason) or dropped. Every run is a paid call.
