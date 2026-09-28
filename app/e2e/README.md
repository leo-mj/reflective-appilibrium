# End-to-end tests

Playwright specs that drive the real SPA in a browser. They complement
`src/**/*.test.jsx` (Vitest, jsdom, component level) by covering the things only
a real browser shows: the force-directed graph actually painting, downloads and
file pickers, the autosaved draft surviving a reload, and colour contrast.

## Running them

```bash
npm run test:e2e            # headless, all projects
npm run test:e2e -- --ui    # pick and step through tests interactively
npm run test:e2e -- --headed --project=chromium
npm run test:e2e -- editing.spec.js
npm run test:e2e:report     # open the HTML report from the last run
```

The first run on a new machine needs the browser once:

```bash
npx playwright install chromium
```

You do **not** need to start the dev server. `playwright.config.js` starts its
own, built as the demo, on a port of its own (5175), and stops it afterwards. A
`npm run dev` you already have running on 5173 is left alone and never used:
it carries your own `.env`, and a suite that assumes the demo build, run against
a backend build, fails in ways that have nothing to do with the code — the
score badges a backend answers for, for instance, which the demo never shows.

## How it is put together

| File | Covers |
| --- | --- |
| `home.spec.js` | landing page, logos, theme toggle, demo load, tutorial |
| `editing.spec.js` | adding elements, counts, graph updates, undo/redo, round bumps |
| `lifecycle.spec.js` | withdraw → reinstate → revise, arguments, history playback |
| `navigation.spec.js` | Analyze tabs, filter chips, search |
| `persistence.spec.js` | draft resume/discard, export → import round trip |
| `assist.spec.js` | assist workflow, accepting a suggestion |
| `discuss.spec.js` | the Discuss panel, against a faked backend — runs only under the `backend` project |
| `questionnaire.spec.js` | questionnaire mode end to end (skips if no spec present) |
| `responsive.spec.js` | narrow layout — runs only under the `mobile` project |
| `live-backend.spec.js` | the SPA against the **real** FastAPI server: withdrawal scores, the simulation, History's round-by-round scores — runs only under the `live-backend` project |
| `statement-cards.spec.js` | the Graph tab's card view where only a browser can tell: cards not overlapping, measured text fitting its card, the pointer landing on one, a grown card taking clicks — and, under `mobile`, a tap growing one |
| `dragging.spec.js` | dragging a node moves it and nothing else, and where it was dropped survives the autosave, a reload and an export → import round trip |
| `a11y.spec.js` | axe-core audit of the composed pages, keyboard reachability |
| `known-issues.spec.js` | fixed defects, and open ones asserted to be still open |

`helpers.js` holds the shared vocabulary — `loadSample`, `addElement`,
`expectCounts` and friends. Prefer adding to it over repeating a selector.

## Conventions worth keeping

- **Pin the environment.** The config forces `VITE_APP_ENV=demo`, which disables
  the backend, the LLM and BYOK. That is what a clean CI checkout gets anyway
  (`app/.env` is gitignored), and it means the assist specs exercise the
  suggestion plumbing against pre-set examples — no API key, no network.
- **Except where demo cannot reach.** Discuss exists only in a build with a
  backend and a saved key, so the `backend` project starts a second dev server
  (port 5174, `VITE_APP_ENV=backend`) whose backend URL is a host that does not
  exist. The spec answers every call to it with `page.route`, so no real server,
  key or provider is involved. Add a spec to `BACKEND_SPECS` in
  `playwright.config.js` only if it needs that build.
- **One project meets the real server.** `live-backend` starts uvicorn from
  the repo root (port 8766) and a dev server built as "backend" pointed at it
  (5176), and runs only what needs no key and calls no third party — the rethon
  scoring and simulation routes. Everything else fakes one side of the line,
  so this is the one place a request or response changed on one side fails.
  It needs Python with `backend/requirements.txt`, as `npm run test:e2e` now
  starts the server; CI's e2e job installs both. The server's settings are
  pinned in `playwright.config.js` — no keys, no tokens, Crossref off, local —
  so `backend/.env` cannot change what it tests. Its first run found History's
  round-by-round scores sending an empty round-0 projection the server refused.
- **A run starts only the servers its projects use** — when they are named
  with `--project`. `--project=chromium` starts the demo server alone;
  `--project=live-backend` the Python server and the build pointed at it. A run
  with no `--project`, or narrowed only by file, `-g` or a wildcard project,
  starts them all, which is what CI's full run does. So to check one desktop
  spec without waiting on the backend: `npx playwright test <file> --project=chromium`.
- **Park the mouse before asserting on text.** Playwright leaves the cursor
  where it clicked, and the app opens a tooltip on hover that sits over panel
  headings. `park(page)` moves it out of the way.
- **Poll counts, do not read them once.** The filter chips re-render from React
  state; a bare read can catch the previous frame. That passes on a fast laptop
  and fails on a loaded runner. Use `expectCounts`.
- **Count elements from the Analyze view.** The chips do not exist in the Assist
  view; `analyzeCounts()` switches first.
- **Do not assert on `document.body.innerText`.** It includes the collapsed
  round log, which quotes statements verbatim, so "this text is gone" checks
  give false failures. Assert per card via `elementCardTexts()`.

## `known-issues.spec.js`

Fixed defects assert the fixed behaviour. Open ones assert that the defect is
**still there**, so the suite stays green while it is open and goes red the
moment it is fixed — the message then says what to write in the assertion's
place.

They used to be `test.fail()`, which does not survive contact with an audit.
Under `test.fail()` every failure is the expected one, so an open defect can
only report by *passing* — and a check that measured nothing passes too. CI hit
exactly that: the faded card the contrast defects are about sits just above the
fold on a Mac and just below it on CI's fonts, axe skips anything off screen, and
the run announced "expected to fail, but passed" over a defect nobody had
touched. Asserting the defect directly keeps those two outcomes apart.

**If you audit something that can scroll, prove you measured it.**
`fadedCardContrast` scrolls its target to the middle of the viewport and returns
`evaluated` alongside `failing`, because axe resolves backgrounds with
`elementsFromPoint`: a node below the fold is reported as `incomplete`, never as
a violation, and an audit of it comes back clean.

## Limitations

- Tests run against the **dev** server, not a production build, so they would
  not catch a build-only problem such as the GitHub Pages `base` path.
- `src/questionnaires/` is gitignored, so `questionnaire.spec.js` skips itself
  in CI and gives real coverage only on a working copy that has a spec.
- One browser (chromium) — including the mobile project, which pins
  `browserName` so CI downloads a single engine.
