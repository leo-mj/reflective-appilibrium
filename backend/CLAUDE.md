# backend/ — Phase 2 FastAPI Backend

Python FastAPI server. Start/stop via `make start` / `make stop`.

## Key files
- `main.py` — FastAPI entry point
- `routers/` — judgments, principles, relations, arguments, review, conversations, sessions, simulate_rethon, llm
- `services/llm.py` — LLM service layer
- `models/re_state.py` — Pydantic state schema

## Notes
- API key lives server-side only (replaces `dangerouslyAllowBrowser` in the frontend)
- `import rethon` (via `routers/simulate_rethon`) configures logging with
  `disable_existing_loggers` at its default, switching off every logger created
  before it. `main.py` re-enables the `backend` tree after the router imports —
  keep that block *after* them, or the assist routers go silent again.
- Target LLMs: Qwen3 30B quantized (consumer GPU), DeepSeek-V3.2 / GPT-OSS-120B (high-end)
