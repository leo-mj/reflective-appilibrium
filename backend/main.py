"""
Assistive Equilibrium — FastAPI backend (V2, local).

Start with:
    uvicorn backend.main:app --reload

Interactive docs at http://localhost:8000/docs
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import llm, matrix, relations

# ── Logging ────────────────────────────────────────────────────────────────────

_handler = logging.StreamHandler()
_handler.setFormatter(logging.Formatter("%(levelname)-8s %(name)s: %(message)s"))
logging.getLogger("backend").addHandler(_handler)
logging.getLogger("backend").setLevel(logging.INFO)

# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Assistive Equilibrium API",
    version="0.1.0",
    description="Backend for the V2 local RE tool.",
)

# ── CORS ───────────────────────────────────────────────────────────────────────

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────

app.include_router(llm.router)
app.include_router(matrix.router)
app.include_router(relations.router)
# Future: app.include_router(coherence.router)
# Future: app.include_router(sessions.router)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "model": settings.openai_model}
