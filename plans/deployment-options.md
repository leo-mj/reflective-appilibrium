# Deploying the backend version — findings and options

Notes from a session on 2026-09-21/22, working on `backend-server`. Nothing in
the repository was changed to produce them: this is measurement and research,
written down so the next session does not have to repeat it.

Measured against `270b4c9` ("Feature: Remove writing to disk") unless a line
says otherwise. Some of the browser checks were run on `2e92d62`, the commit
before it, and are marked where that matters — server-side session storage was
removed in between, so anything touching `/api/sessions` describes a server that
no longer exists.

Two findings at the end are defects rather than decisions, and are the part of
this document with a deadline.

## What was verified

The branch runs. On a clean container, from nothing:

| Step | Result |
| --- | --- |
| `pip install -r backend/requirements.txt` on the system Python | **fails** — no wheels for `pypblib`, `astutils`, `ply`; see below |
| the same inside a fresh venv after `pip install -U pip setuptools wheel` | works |
| `uvicorn backend.main:app` | `/api/health` → `{"status":"ok","model":"gpt-4o-mini","deployment":"local","max_simulation_elements":0}` |
| `pytest backend/` | 452 passed, 50s |
| `npm install && npm run dev` | Vite 8, ready in 307ms |
| the app in Chromium, against the live backend | sample process at round 8; no console errors. On `2e92d62`: `/api/health` and `/api/sessions` both 200 — the latter is gone now |

The frontend unit and e2e suites were **not** run, so nothing here says anything
about them.

Two things cost time and are worth knowing before they cost it again:

- **The build failure is about build isolation, not about the packages.** The
  system Python's pip could not build `pypblib`, `astutils` or `ply`; the same
  requirements install cleanly in a venv whose `setuptools` and `wheel` are
  current. The Dockerfile already gets this right — it installs `g++` in the
  build stage precisely because `pypblib` ships only C++ source.
- **`app/.env` is required and gitignored.** Without it `VITE_APP_ENV` is unset,
  so `BACKEND_ENABLED` is false (`app/src/config.js`) and the Assist, Discuss and
  Simulate tabs fall back to samples. That failure looks exactly like a backend
  that is down, and is not one. It wants:

      VITE_APP_ENV=dev
      VITE_BACKEND_URL=http://localhost:8000

- **Browse `localhost:5173`, not `127.0.0.1:5173`.** `CORS_ORIGINS` names the
  first literally and permits no wildcards, so the other spelling is a CORS wall
  that looks like a broken backend.

## Measurements

These are what the hosting decision turns on, so they are recorded rather than
summarised.

| | |
| --- | --- |
| uvicorn parent, idle (rethon imported at startup) | **218 MB** RSS |
| a bare `import rethon` in a fresh process | **156 MB**, 0.85s |
| the venv | 552 MB — `llvmlite` 173, `pandas` 75, `numpy` 45, `numba` 35 |
| the backend image, estimated from that plus `python:3.12-slim` | **~0.8 GB** |
| `dist/` after `npm run build:backend` | 1.1 MB; main chunk 535 KB, 166 KB gzipped |

`process_pool.py` spawns two pools of one worker each, and spawn (not fork) means
each worker imports rethon afresh. So a server that has served both a simulation
and a score holds roughly **450–550 MB**. The range is because the native
libraries are mmap'd and their pages are shared between processes, which cgroup
accounting counts once; 218 + 156 + 156 is an upper bound, not a prediction.

**The operative conclusion: 512 MB is not enough. 1 GB is the floor.** That one
number disqualifies more hosting options than anything else here.

## Hosting

### Cloudflare

Workers is out for the backend and it is not close. The Python runtime is
Pyodide, which takes pure-Python packages and those published for PyEmscripten;
rethon pulls `numba`, `llvmlite`, `python-sat`, `pypblib` and `dd`. Beyond the
packaging, `process_pool.py` uses `multiprocessing`, which has no Workers
equivalent — and that pool is not decorative, it is what makes a simulation
killable on a timeout.

Cloudflare *Containers* would run the image, but needs a Worker and a
`wrangler` config that do not exist in this repository, and nothing else about
Cloudflare compensates for writing them.

### Fly.io and Render

The Dockerfile's own header anticipates both. Neither has a usable free tier:
Fly discontinued its allowance in 2024 (new accounts get a trial of 2 VM-hours
or 7 days), and the legacy allowance was 256 MB machines, which the measurement
above rules out anyway. Render's free instance is 512 MB and 0.1 CPU — the
memory is arguably borderline, the CPU is not, against a workload where
`.env.example` records 25 elements taking about 13 seconds.

Paid, Fly is roughly $6/month for 1 GB; Render would push to Standard at about
$25 for 2 GB, since Starter's 512 MB sits in the danger zone. Fly also stops
machines when idle and bills only rootfs (~$0.15/GB per 30 days), which for
~0.8 GB is about **$0.12/month** fully stopped. For a bursty teaching pattern —
a seminar, then a week of nothing — that puts the real bill under a pound.

### Google Cloud Run — the recommendation

A perpetual free tier of 180,000 vCPU-seconds, 360,000 GiB-seconds and 2M
requests per month. At 1 vCPU / 1 GiB, CPU binds first: **50 instance-hours a
month, free, indefinitely.** It takes the image unmodified, it is x86 so there
is no ARM question, and 1 GiB clears the measurement.

Three things it needs:

- **`--max-instances=1`, non-negotiable.** Cloud Run autoscales, and every
  instance carries its own copy of the in-memory rate limiter. This is the same
  hazard as Fly's default machine pair and as a second uvicorn worker; the
  README states it at the worker level and it is equally true one level up.
- **Startup CPU boost**, because a 0.8 GB image pull precedes the 0.85s rethon
  import. Expect 10–30s on the first request after idle.
- **A budget alert.** The free tier is an allowance, not a cap; overage is
  billed.

Nothing needs a volume on any of these hosts. Since `270b4c9` the server keeps
no state on disk at all — `storage.py`, the `sessions` router and the
`SESSIONS_ENABLED` / `SESSIONS_DIR` settings are gone, and the Discuss panel was
already stateless. Ephemeral container disk is not a compromise here, it is the
whole design, which is one fewer thing to configure and one fewer thing holding
a participant's reasoning.

*Corrected 2026-10-03.* This paragraph used to say the app fetched
`/api/health` on page load, so the wake began when a reader opened the tab. That
was untrue of the build deployed: the health check was sent only once an editor
component asked for it, and a reader on the start page woke nothing — observed on
the live site, where the instance started only after "Skip guided tour". Since
`cold-start` the start page sends the health check and then a warm-up request as
it appears; see "Cold start — 2026-10-03" below.

### Oracle Cloud Always Free — the alternative

A genuine always-free VM, halved without announcement on 15 June 2026 from
4 OCPU / 24 GB to 2 OCPU / 12 GB. Even halved it dwarfs everything else free.

It is ARM, so the dependency tree was checked against PyPI:

| Package | aarch64 wheels |
| --- | --- |
| `llvmlite`, `numba`, `numpy`, `pandas`, `python-sat`, `bitarray` | yes |
| `pypblib` | **none** — sdist only |
| `dd` | **none** — sdist only |

`pypblib` already builds from source on x86 and the Dockerfile installs `g++`
for it, so ARM changes nothing there. `dd` currently arrives as an x86 wheel and
would have to build from its sdist; its default backend is pure-Python
`autoref`, so this probably works, but **it was not tested** — there was no
Docker daemon available to cross-build. The likelier obstacles are anyway
non-technical: ARM capacity is frequently unavailable in popular regions, idle
instances are reclaimed, and the June change arrived with no notice.

### The frontend stays where it is

*Superseded by "Decision — 2026-09-22" below: the demo stays on GitHub Pages and
the version with the AI features moves to Cloudflare (revised below from Pages
to a Worker serving static assets). The argument against
serving the frontend from Cloud Run still stands.*

The backend serves no static files — `main.py` has no `StaticFiles` mount, and
its only HTML is the two docs endpoints that a `hosted` instance 404s. Serving
`dist/` from the same service would mean adding one, and relaxing
`.dockerignore`, whose allowlist shape is deliberate and says why. Against that
there is nothing to gain: static assets on a CDN cost nothing, and served from
Cloud Run they would spend the vCPU-seconds that exist for rethon, and would put
the cold start on the page load instead of behind it.

So: leave the frontend on GitHub Pages and repoint `VITE_BACKEND_URL` at the
Cloud Run URL. That is a one-variable change to an already-working deploy job.

Moving it to Cloudflare Pages buys one real thing, which
`vite-plugins/contentSecurityPolicy.js` already names: GitHub Pages serves no
custom response headers, so the CSP arrives as a `<meta>` tag, and
`frame-ancestors`, `report-uri` and `sandbox` are ignored when delivered that
way. A `_headers` file would deliver them for real. Worth knowing the size of
the prize: the directive that protects visitors' API keys is `connect-src`, and
that **already works** in the meta tag. What is missing is clickjacking
protection and violation reporting. Clickjacking cannot read a key — same-origin
policy holds regardless — so the exposure is tricking someone into clicking
inside the app, which undo mostly covers. Real, worth closing eventually, not
urgent.

Cloudflare Access is **not** part of this. It was raised and it was the wrong
suggestion: its free tier covers 50 authenticated seats, which suits a closed
cohort and not an open tool, and it is in no way a precondition for the
`_headers` benefit. A Pages site with no Access in front serves unlimited
visitors.

## Two defects found along the way

Both matter specifically for an open deployment with `APP_ACCESS_TOKENS` empty,
which is a posture this app can legitimately take: under `DEPLOYMENT=hosted`,
`server_keys_allowed` is `not is_hosted` → false (`config.py`), so a keyless
caller is refused at `dependencies.py` with "This server does not lend out API
keys; supply your own". An open backend therefore cannot spend the operator's
API budget. What it can spend is CPU.

### 1. The rate limiter is evadable by a header

With no tokens, `client_identity` keys on `"ip:" + request.client.host`
(`dependencies.py`). On the shipped image `request.client` is not the socket
peer:

1. the Dockerfile's CMD passes `--forwarded-allow-ips="*"`;
2. that puts uvicorn's proxy middleware in `always_trust`, where
   `get_trusted_client_address` returns `x_forwarded_for_hosts[0]` — the
   **leftmost** entry;
3. proxies append to `X-Forwarded-For`, so the leftmost entry is whatever the
   caller sent.

A caller rotating `X-Forwarded-For` gets a fresh bucket per request, and the
hosted simulation cap of 5/min — guarding the most expensive endpoint — stops
applying to anyone who bothers. The fix is to key on something the caller cannot
choose: narrow `--forwarded-allow-ips` to the platform's proxy, or take the
rightmost untrusted entry, or put Cloudflare in front and key on
`CF-Connecting-IP` (its WAF rate limiting runs before the origin and is not
header-spoofable, which is the Cloudflare benefit that does scale to an open
user base).

### 2. `ALLOW_LOOPBACK_SERVER_KEYS` and `--forwarded-allow-ips="*"` must not meet

`dependencies.py` says, of the `_LOOPBACK` check: *"request.client is the socket
peer, so this cannot be spoofed by a header."* True under plain uvicorn. Not
true under the image's `*`, where the value has already been overwritten from
the header.

Harmless as shipped, because `hosted` refuses server keys before that check is
reached. But `.env.example` invites `ALLOW_LOOPBACK_SERVER_KEYS=true` "only if
you run uvicorn behind `--forwarded-allow-ips=<proxy ip>`" — deliberately
narrowed — and the image's CMD uses `*`. Follow the one on the other and
`X-Forwarded-For: 127.0.0.1` unlocks the server-side keys to anyone. Each
document is right alone. Together they are a trap, and at minimum the comment
and `.env.example` should say so.

## Before any deployment

- `APP_ACCESS_TOKENS` — empty by default, and the README is blunt about what
  that means. Empty is defensible here given BYOK, but it is a decision, not a
  default to drift into.
- `CORS_ORIGINS` — the frontend origin exactly, no wildcards. For GitHub Pages,
  `https://leo-mj.github.io`.
- `MAX_SIMULATION_ELEMENTS` — leave at the hosted default of 20. It bounds the
  cost of one request, which a rate limit cannot.
- `backend-server` is 20 commits ahead of `origin/main` and 0 behind. The
  `deploy` job refuses to publish commits that are not ancestors of `main`, so
  on the current Pages path none of this is releasable until it is merged.

## Open questions

- Whether to fix the two defects on this branch or separately. Neither is large;
  the first is a genuine fix, the second may be only a comment and a line in
  `.env.example`.
- Whether `dd` builds on aarch64, if Oracle is ever seriously considered.
- Whether the frontend moves to Cloudflare Pages for the `_headers` CSP. If it
  does, the CSP plugin should emit the policy for a header as well as the meta
  tag, from the one directive list, rather than the list being written twice.
- `__pycache__/` at the repository root is caught by no `.gitignore`;
  `backend/.gitignore` covers only the one inside `backend/`. One line fixes it.

## Decision — 2026-09-22

The frontend moves after all, and splits. From one commit on `deploy`, once CI's
test jobs pass:

| Target | Build | Talks to |
| --- | --- | --- |
| GitHub Pages | `npm run build` — the demo | nothing; no backend, no LLM |
| Cloudflare Pages | `npm run build:backend`, `VITE_BASE_PATH=/`, `VITE_BACKEND_URL` = the Cloud Run URL | Cloud Run |
| Cloud Run | the existing `Dockerfile` | — |

This settles the third open question above, and makes the README's "the Pages
URL is the demo" true.

- **Cloudflare is built in GitHub Actions** and uploaded with
  `wrangler pages deploy`, not by Cloudflare's Git integration, which would
  build every push to the branch whether or not the tests passed.
- **The CSP plugin emits a `_headers` file as well as the meta tag**, from one
  directive list. That is the reason to be on Cloudflare at all; without it the
  move gains nothing on the security side.
- **`CORS_ORIGINS` names the Cloudflare origin only.** The demo never calls the
  backend.
- **Cloud Run**, as recommended above: `--max-instances=1`, 1 GiB, startup CPU
  boost, a budget alert, and no minimum instance — the start page's wake-up
  hides most of the cold start (see "Cold start — 2026-10-03"; when this was
  written the fetch it relied on did not yet happen on page load), and an
  always-on instance would spend the free tier idling. Plus `TRUSTED_PROXY_HOPS=1`, below.
- Cloud Run is deployed from CI, but only by hand: `deploy-backend` runs from
  the Actions tab, never on a push. The two static sites deploy on every push
  to `deploy` (`deploy` and `deploy-cloudflare`), the Cloudflare one reading the
  backend's address from `VITE_BACKEND_URL`.

**Revision — 2026-09-27: a Worker, not a Pages project.** The dashboard now
labels Pages "legacy", and new Cloudflare features land in Workers only. No
end-of-life date has been announced, but a new site on Pages would be a
migration scheduled for later, so the AI version is deployed as an assets-only
Worker instead: `wrangler deploy --assets=dist --name=… --compatibility-date=…`,
the name from `CLOUDFLARE_WORKER_NAME`. It needs no configuration file in the
repository and no project created in the dashboard — the first deploy creates
the Worker — and the token needs *Workers Scripts: Edit* rather than *Pages:
Edit*. The address is `https://<name>.<subdomain>.workers.dev`. The app has no
client-side routes, so there is no single-page fallback to configure.

What mattered was that `_headers` still arrives as headers. Checked locally with
Cloudflare's own runtime (`wrangler dev --assets=dist`, wrangler 4.142): `/`
carries the Content-Security-Policy as a response header, `frame-ancestors
'none'` included, with `referrer-policy` and `x-content-type-options`, and
`/_headers` itself answers 404. Worth one `curl -I` against the live address
after the first deploy all the same.

**Both defects are fixed on `backend-server`.** The image no longer passes
`--forwarded-allow-ips="*"`. A new setting, `TRUSTED_PROXY_HOPS`, makes
`client_identity` read the caller from the *right* of `X-Forwarded-For` — the
entry the platform's proxy appended — so forged entries to its left no longer
buy a fresh allowance. The loopback grant now also requires every address in
the forwarded chain to be loopback, so `X-Forwarded-For: 127.0.0.1` cannot
unlock server keys through a proxy even if someone reinstates the `*`.

Order of work: that fix; the `_headers` output; `ci.yml`; Cloud Run; then
`RELEASING.md` rewritten for three targets.

## Cold start — 2026-10-03

Observed on Cloud Run: about **25 s** from "Starting new instance" to "STARTUP
TCP probe succeeded", startup CPU boost on. The image is streamed lazily, so
the cost is mostly reading files, and the server read a great many: importing
`backend.main` imported the whole rethon stack (numba, llvmlite, pandas, …)
through the routers, although only the workers compute with it.

Three changes on the `cold-start` branch:

1. **The server no longer loads rethon.** The routers import
   `services/rethon_tasks.py`, which holds the request validation and light
   stand-ins that the pools pickle by reference; the workers import the heavy
   modules on their first task. `backend/tests/test_startup_imports.py` fails if
   `import backend.main` loads any of the heavy packages again.
2. **The start page wakes the backend**: `/api/health`, then
   `POST /api/simulate_rethon/warm`, which starts both worker pools and answers
   when they are up. It runs *inside* a request because Cloud Run's
   request-based billing gives an instance CPU only while a request is in
   flight; warming in the background after start-up would not progress.
3. **The editor says when it is still waiting** (`ServerWakeNotice`): after two
   seconds, which phase (server starting, or workers loading rethon) and the
   seconds elapsed.

Measured in this repository's cloud container with `make measure-startup
ARGS=--cold` (Linux; `--cold` evicts the package files from the page cache, the
nearest local analogue of a lazily streamed image):

| | before | after |
| --- | --- | --- |
| native libraries the server maps at import | 263 MB | **5.4 MB** |
| Python modules the server reads at import | 37.3 MB | **12.7 MB** |
| heavy packages loaded by the server | all 8 | **none** |
| `/api/health` answering, cold | 3.88 s | **2.38 s** |
| `/api/health` answering, warm cache | 2.64 s | 1.93 s |
| server RSS, idle | 219 MB | **97 MB** |
| process tree RSS after a score and a simulation | 670 MB | 548 MB |
| first score / first simulation, no warm-up | 3.37 / 2.30 s | 2.08 / 1.60 s — noise, see below |
| `/warm`, cold | — | 2.48 s |
| first score / first simulation after `/warm` | — | **0.71 / 0.63 s** |

Those are single runs, and one row did not survive repeating. Re-run on
2026-10-05 in a fresh container, the two versions alternated, four runs each
without the warm-up and three with it:

| | before | after |
| --- | --- | --- |
| `/api/health` answering, cold | 4.8–6.1 s | 3.0–4.0 s |
| first score, no warm-up | 3.1–3.7 s | 3.0–3.7 s |
| first simulation, no warm-up | 3.1–3.9 s | 3.6–4.4 s |
| `/warm`, cold | — | 3.2–3.7 s |
| first score / simulation after `/warm` | — | 1.1–1.3 s |

**The split does not make the first computation faster; the warm-up moves its
cost.** The workers are spawned, not forked, so each always imported rethon for
itself, whether or not the server had. Keeping rethon out of the server shortens
the server's start; `/warm` then pays the workers' import while the reader is on
the start page, so a computation that comes after it does not.

These are local numbers; the container reads from a local disk. What carries
over to Cloud Run is the ratio of bytes read before the server can answer,
roughly 300 MB down to 18 MB, not the seconds. The real figure has to be read
off the Cloud Run logs after the next deploy.

What is left of the server's import is mostly the LLM SDKs (`anthropic` ≈ 0.9 s,
`openai` ≈ 0.4 s, through `services/llm.py`). Importing them lazily is the next
step if the deployed cold start is still long; the tests patch
`backend.services.llm.AsyncOpenAI` and `AsyncAnthropic`, so that needs care.

**Follow-up, the same day.** Two more things, found on the live site and by
profiling a worker's first call:

- **A worker's first computation compiled numba code.** theodias's position
  functions are `@jit(nopython=True)` without `cache=True`, so each new worker
  compiled them on its first call: 2.0 s for a score and 0.86 s for a
  simulation, in a fresh process, against 0.001–0.005 s after. `/warm` now has
  each worker run a small score or simulation (`services/rethon_warmup.py`).
  Measured with `--cold`: `/warm` 4.2–4.7 s, then the first score and
  simulation 0.01–0.02 s (they were 1.1–1.3 s after a warm-up that only started
  the workers).
- **Cloud Run answered a cold start's first `/api/health` with a 500.** It came
  from the platform, not the app, so it had no CORS header and the browser
  reported it as a CORS failure. The app took that single failure as "server
  unreachable" for the rest of the page load, which also meant "no depth limit
  known": the Simulate tab offered depths 1–4 starting at 3, and the server,
  limited to 2, refused the run with a 422. The health check is now retried
  every 3 s for up to 90 s on a network error, a 429 or a 5xx, and the Simulate
  tab neither offers a depth nor runs until the server has answered. The
  request log in Cloud Run gives the platform's own message for such a 500.
