"""
Reflective Appilibrium — FastAPI backend (V2, local).

Start with:
    uvicorn backend.main:app --reload

Interactive docs at http://localhost:8000/docs
"""

import logging
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .dependencies import (
    rate_limit_simulation,
    require_access_token,
    require_sessions_enabled,
)
from .routers import (
    conversations,
    judgments,
    llm,
    matrix,
    principles,
    relations,
    sessions,
    simulate_rethon,
    arguments,
)

# ── Logging ────────────────────────────────────────────────────────────────────

_handler = logging.StreamHandler()
_handler.setFormatter(logging.Formatter("%(levelname)-8s %(name)s: %(message)s"))
logging.getLogger("backend").addHandler(_handler)
logging.getLogger("backend").setLevel(logging.INFO)

# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Reflective Appilibrium API",
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

# Applied here rather than per-route so that a new endpoint is gated by default:
# forgetting to add the dependency is the mistake that matters, and adding a
# router to this list is harder to forget than decorating each of its routes.
# Health is deliberately left open so an uptime check needs no credential.
_gated = [Depends(require_access_token)]

app.include_router(arguments.router, dependencies=_gated)
app.include_router(conversations.router, dependencies=_gated)
app.include_router(judgments.router, dependencies=_gated)
app.include_router(llm.router, dependencies=_gated)
app.include_router(matrix.router, dependencies=_gated)
app.include_router(principles.router, dependencies=_gated)
app.include_router(relations.router, dependencies=_gated)
app.include_router(
    sessions.router, dependencies=_gated + [Depends(require_sessions_enabled)]
)
app.include_router(
    simulate_rethon.router, dependencies=_gated + [Depends(rate_limit_simulation)]
)


# ── Health ─────────────────────────────────────────────────────────────────────


@app.get("/api/health", tags=["meta"])
async def health(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    """Return service status, the active model, and which features are on.

    Deliberately outside the access-token gate so an uptime check needs no
    credential. ``sessions`` is what lets the frontend hide the save and load
    controls rather than offer them and fail: the browser cannot otherwise know
    whether this instance persists anything.

    Reads settings through the dependency rather than the module-level value so
    that it reflects overrides, which is also what makes it testable.
    """
    return {
        "status": "ok",
        "model": settings.default_model,
        "deployment": settings.deployment,
        "sessions": settings.sessions_on,
    }
