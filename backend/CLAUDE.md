# backend/ — Phase 2 FastAPI Backend

Python FastAPI server. Start/stop via `make start` / `make stop`.

## Key files
- `main.py` — FastAPI entry point
- `routers/` — judgments, principles, relations, arguments, review, theories, conversations, sessions, simulate_rethon, llm
- `services/llm.py` — LLM service layer
- `services/crossref.py` — reference checking for the theories router
- `models/re_state.py` — Pydantic state schema

## Notes
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
- `import rethon` (via `routers/simulate_rethon`) configures logging with
  `disable_existing_loggers` at its default, switching off every logger created
  before it. `main.py` re-enables the `backend` tree after the router imports —
  keep that block *after* them, or the assist routers go silent again.
- Target LLMs: Qwen3 30B quantized (consumer GPU), DeepSeek-V3.2 / GPT-OSS-120B (high-end)
