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

The cold start is survivable for a reason worth recording: the app fetches
`/api/health` on page load, so the wake begins when a reader opens the tab and
finishes while they are on the intro and tutorial screens, rather than when they
press Simulate.

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
