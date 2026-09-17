"""
Reflective Appilibrium — FastAPI backend (V2, local).

Start with:
    uvicorn backend.main:app --reload

Interactive docs at http://localhost:8000/docs
"""

import logging
from contextlib import asynccontextmanager
from typing import Annotated, AsyncGenerator

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse

from .config import Settings, get_settings
from .dependencies import (
    proxy_startup_warning,
    rate_limit_scoring,
    rate_limit_simulation,
    rate_limit_stepping,
    require_access_token,
    require_sessions_enabled,
)
from .routers import (
    conversations,
    judgments,
    llm,
    principles,
    relations,
    review,
    sessions,
    simulate_rethon,
    theories,
    arguments,
)
from .logging_setup import configure_backend_logging
from .process_pool import shutdown_pools
from .security_headers import SecurityHeadersMiddleware

# ── Logging ────────────────────────────────────────────────────────────────────

# Must stay after the router imports: `import rethon`, reached through
# routers.simulate_rethon, disables every logger created before it, and this is
# what switches ours back on. See logging_setup for the whole story — the
# simulation workers call the same function, so the two cannot drift.
configure_backend_logging()

# ── App ────────────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Stop the simulation workers on shutdown.

    Only shutdown: the pool is created lazily on first use, not here, because the
    test suite never runs startup — see process_pool.
    """
    yield
    shutdown_pools()


app = FastAPI(
    lifespan=lifespan,
    title="Reflective Appilibrium API",
    version="0.1.0",
    description="Backend for the V2 local RE tool.",
    # Served by the routes under "Docs" below instead, which can see the mode.
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# ── CORS ───────────────────────────────────────────────────────────────────────

settings = get_settings()
if _proxy_warning := proxy_startup_warning(settings):
    logging.getLogger("backend.main").warning(_proxy_warning)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Added last so it is outermost, and a CORS preflight answer carries the headers too.
app.add_middleware(SecurityHeadersMiddleware)

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
app.include_router(principles.router, dependencies=_gated)
app.include_router(relations.router, dependencies=_gated)
app.include_router(review.router, dependencies=_gated)
app.include_router(
    sessions.router, dependencies=_gated + [Depends(require_sessions_enabled)]
)
# Three routers over one prefix, each with its own allowance, because "how
# expensive is one call" and "how often is it called" are independent here and a
# single bucket can only express one of them.
#
# Both splits were made after the shared bucket broke something. /quick_score and
# /score_changes are fired by the frontend on every edit and once per suggestion
# card, so a limit low enough to restrain /simulate blanked the score badges of
# anyone editing — silently, since the client renders a failed score as an empty
# badge. /step costs what /simulate costs but is pressed once per step, so the
# same limit stopped the stepper at its sixth press.
app.include_router(
    simulate_rethon.router, dependencies=_gated + [Depends(rate_limit_simulation)]
)
app.include_router(
    simulate_rethon.stepping_router,
    dependencies=_gated + [Depends(rate_limit_stepping)],
)
app.include_router(
    simulate_rethon.scoring_router, dependencies=_gated + [Depends(rate_limit_scoring)]
)
app.include_router(theories.router, dependencies=_gated)


# ── Docs ───────────────────────────────────────────────────────────────────────

# Local only. The docs routes are not routers, so `_gated` never covered them, and
# on a public instance they publish the whole schema beside a "Try it out" button
# that spends whatever key the visitor types into it. Checked per request through
# the settings dependency, like health below, so the mode is testable.


def _require_local(settings: Annotated[Settings, Depends(get_settings)]) -> None:
    if settings.is_hosted:
        raise HTTPException(status_code=404, detail="Not Found")


_docs_only = [Depends(_require_local)]


@app.get("/openapi.json", include_in_schema=False, dependencies=_docs_only)
async def openapi_schema() -> JSONResponse:
    return JSONResponse(app.openapi())


@app.get("/docs", include_in_schema=False, dependencies=_docs_only)
async def swagger_docs() -> HTMLResponse:
    return get_swagger_ui_html(openapi_url="/openapi.json", title=app.title)


@app.get("/redoc", include_in_schema=False, dependencies=_docs_only)
async def redoc_docs() -> HTMLResponse:
    return get_redoc_html(openapi_url="/openapi.json", title=app.title)


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

    ``max_simulation_elements`` is here for the same reason, and 0 means no cap.
    The score-delta badges ask what the state *plus one suggested element* would
    score, so at exactly the cap every badge asks for one element too many and
    gets a 422 while the baseline beside it succeeds. Telling the browser the
    number lets it stop asking instead of firing a request per card that can only
    be refused.

    Reads settings through the dependency rather than the module-level value so
    that it reflects overrides, which is also what makes it testable.
    """
    return {
        "status": "ok",
        "model": settings.default_model,
        "deployment": settings.deployment,
        "sessions": settings.sessions_on,
        "max_simulation_elements": settings.simulation_max_elements,
    }
