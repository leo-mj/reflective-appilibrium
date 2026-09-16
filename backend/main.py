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

# ── Logging ────────────────────────────────────────────────────────────────────

_handler = logging.StreamHandler()
_handler.setFormatter(logging.Formatter("%(levelname)-8s %(name)s: %(message)s"))
logging.getLogger("backend").addHandler(_handler)
logging.getLogger("backend").setLevel(logging.INFO)

# `import rethon`, reached above through routers.simulate_rethon, applies a logging
# configuration with `disable_existing_loggers` left at its default — which switches
# off every logger that already exists, i.e. every module imported before it. That
# silently dropped all output from the routers earlier in the import list above, the
# assist routers among them, including the error logs that say a model returned
# unparseable JSON. Undo it for our own tree; it must stay after the imports.
for _name, _logger in logging.Logger.manager.loggerDict.items():
    if _name.startswith("backend") and isinstance(_logger, logging.Logger):
        _logger.disabled = False

# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Reflective Appilibrium API",
    version="0.1.0",
    description="Backend for the V2 local RE tool.",
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
