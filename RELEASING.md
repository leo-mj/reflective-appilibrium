# Pre-release checklist

A release is a push to `deploy`. CI then runs the four test jobs and, if they
pass, builds `npm run build:backend` and publishes it to GitHub Pages. The
backend image is deployed by hand. Everything below is what CI does **not**
check, plus the CI gates, listed so you can see them all in one place.

Copy the list into the release PR or an issue and tick it off there.

## 1. Code is on main

- [ ] Feature branch merged into `main` through a PR, and CI is green on `main`.
- [ ] `deploy` will be reset or fast-forwarded to a commit **on `main`**. The
      deploy job refuses a `deploy` with commits `main` does not have. Never fix
      anything directly on `deploy`.
- [ ] Open Dependabot PRs reviewed: merge them, or decide to leave them until
      after the release.
- [ ] Working tree clean. Nothing needed for the release lives only in a
      gitignored file (see §5 on questionnaires).

## 2. Tests (CI gates, for completeness)

- [ ] `npm run lint` and `npm test` pass in `app/`.
- [ ] `pytest backend/` passes from the repo root.
- [ ] The Playwright suite passes in CI (`e2e` job). Locally, run at most the
      spec for what changed.
- [ ] `npm audit --omit=dev --audit-level=high` is clean. This check blocks the
      release.
- [ ] You have read the output of the two checks that do not block: the
      dev-dependency `npm audit` and `pip-audit`.
- [ ] `known-issues.spec.js`: the open defects listed there are still ones you
      accept shipping.

## 3. Frontend build (what e2e cannot see)

The e2e suite runs against the **dev** server, so none of this is tested:

- [ ] The repository variable `VITE_BACKEND_URL` (Settings → Secrets and
      variables → Actions → Variables) is the backend's live `https://`
      address, not the placeholder in `app/.env.backend`.
- [ ] Build locally with that value (`VITE_BACKEND_URL=https://… npm run
      build:backend`), then `npm run preview`:
  - [ ] No `[config] VITE_BACKEND_URL is still a placeholder` error in the console.
  - [ ] Assets load under the `/reflective-appilibrium/` base path (no 404s in
        the Network tab).
  - [ ] `dist/index.html` has a CSP `<meta>` tag whose `connect-src` names the
        backend origin, and the page reports no CSP violations.
  - [ ] Theme and contrast mode apply on first paint. The inline script is
        allowed by its hash, so a stale hash shows up as a theme flash here.
- [ ] If the branding sources changed, `make branding` was re-run and the PNGs
      are committed. CI cannot render them.
- [ ] The absolute `og:url` / `og:image` in `app/index.html` still point at
      the address the site will be served from.

## 4. Backend deploy

- [ ] The image the host runs is built from **the same commit** as the site.
      The site and the backend are released together.
- [ ] `DEPLOYMENT=hosted` is set. The image sets this by default, so check the
      host does not override it.
- [ ] `CORS_ORIGINS` is exactly the site's origin, `https://leo-mj.github.io`,
      with no path and no trailing slash. It is empty when one proxy serves
      both the page and `/api`.
- [ ] `APP_ACCESS_TOKENS`: set, with **one token per participant**, if the
      release is for a class or study. Otherwise, a deliberate decision to
      leave the API open.
- [ ] No `LLM_API_KEYS` in the hosted environment. Hosted instances never lend
      them, so they would only add risk.
- [ ] One uvicorn worker. The rate limiter is in-process.
- [ ] `--forwarded-allow-ips` is narrowed to the proxy's address where it is
      known, and the port is not also published directly.
- [ ] `CROSSREF_MAILTO` is the operator's address, or empty. It is never a
      user's address.
- [ ] Rate limits, the timeout and the element cap follow the hosted defaults
      (60 LLM / 5 simulate / 30 step / 300 score per minute, 20 elements, 60s)
      unless you chose otherwise on purpose.
- [ ] After the deploy, from outside:
  - [ ] `GET /api/health` returns `"deployment":"hosted"`.
  - [ ] `/docs` returns 404.
  - [ ] Every `/api/sessions` verb returns 404. The server writes nothing to
        disk.
  - [ ] A request without a token gets refused, if tokens are set.

## 5. Content and sample data

- [ ] The sample process loads, and **Merge (demo)** brings in
      `sample-data/sample-process-climate-duties.md`. After that the Merge tab
      offers the five sample pairs.
- [ ] Questionnaires: `app/src/questionnaires/` is gitignored, so **a CI build
      ships none**. Confirm that is what you want for this release. If not,
      the spec has to be committed or supplied some other way.
- [ ] Every assist sample fixture still matches the current response shape.
      The demo build and the "use sample suggestions" checkbox serve these.

## 6. Smoke test on the live site (after Pages publishes)

Hard-reload first, because Pages caches. Then, with a BYOK key:

- [ ] Home page, theme toggle, high-contrast mode, Tutorial.
- [ ] LLM settings: Test and Save a key. The key goes only to the backend,
      in `x-api-key` (check the Network tab).
- [ ] One full workflow iteration: Judgments → Principles → Theories (with
      Crossref states shown) → Arguments → Relations.
- [ ] Discuss panel, and Simulate with a small process.
- [ ] A process review, once there are ≥2 log entries.
- [ ] Export to Markdown, reload, import: the process round-trips, including
      groups, reviews and process tags.
- [ ] Reload mid-process: "Continue where you left off" appears.
- [ ] Phone width: tour sheet, add button, no horizontal scroll.
- [ ] The Privacy modal's claims ("Nothing on disk", BYOK in sessionStorage)
      still match what the backend does.

## 7. Documentation and record

- [ ] The root `README.md`, `app/README.md` and `backend/.env.example` still
      describe what ships: which build is public, the assist tabs, the
      deployment-mode table, and the Python/Node versions.
- [ ] `version` in `app/package.json` bumped and a git tag made, if releases
      are versioned.
- [ ] Release notes written, covering what changed for users and any change
      to what leaves the browser.
- [ ] Rollback plan: the previous `deploy` commit and the previous image tag
      are known. Pages redeploys on a push to `deploy`, so roll back by
      resetting `deploy` to that commit. It must still be on `main`.
