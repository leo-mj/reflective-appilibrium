# backend/ — Phase 2 FastAPI Backend

Python FastAPI server. Start/stop via `make start` / `make stop`.

## Key files
- `main.py` — FastAPI entry point
- `routers/` — judgments, principles, relations, matrix, llm
- `services/llm.py` — LLM service layer
- `models/re_state.py` — Pydantic state schema

## Notes
- API key lives server-side only (replaces `dangerouslyAllowBrowser` in the frontend)
- Target LLMs: Qwen3 30B quantized (consumer GPU), DeepSeek-V3.2 / GPT-OSS-120B (high-end)
