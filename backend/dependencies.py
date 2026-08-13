"""
Shared FastAPI dependencies.

Each `get_*` function can be overridden in tests via `app.dependency_overrides`.
"""

import hashlib
import secrets
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, Request

from .config import Settings, get_settings
from .ratelimit import FixedWindowLimiter
from .services.llm import LLMConfig, LLMService
from .storage import MarkdownSessionStore

# Must stay in sync with LLM_PROVIDERS in app/src/constants/llmProviders.js.
# This is the security boundary — the frontend list is UX only.
ALLOWED_BASE_URLS = {
    "https://api.openai.com/v1",
    "https://api.mistral.ai/v1",
    "https://api.anthropic.com/v1",
    "http://localhost:11434/v1",
}


def require_sessions_enabled(
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    """Gate the sessions router on ``SESSIONS_ENABLED``.

    Off by default when hosted. Storing other people's moral reasoning on a
    shared machine makes the server a data controller for it, and the browser
    already keeps the working state — so a hosted instance holds nothing, and
    participants keep their own sessions via localStorage and Markdown export.
    A local install keeps disk storage: that is the researcher's own machine.
    """
    if not settings.sessions_on:
        raise HTTPException(
            status_code=403,
            detail=(
                "Server-side session storage is disabled on this instance. "
                "Your work is kept in this browser; use Export to save a copy."
            ),
        )


@lru_cache
def get_session_store() -> MarkdownSessionStore:
    """Return the singleton session store backed by the configured directory.

    Override in tests with ``app.dependency_overrides[get_session_store]``.
    To swap for a SQLite backend, change the return type and body here; the
    router depends only on the ``SessionStore`` protocol, not this concrete type.
    """
    return MarkdownSessionStore(Path(get_settings().sessions_dir))


_LOOPBACK = {"127.0.0.1", "::1", "localhost"}


def _matching_token(supplied: Optional[str], accepted: set) -> Optional[str]:
    """Return the accepted token equal to ``supplied``, or None.

    Every candidate is compared even after a match, and with
    ``secrets.compare_digest`` rather than ``==``: both plain equality and an
    early ``break`` finish sooner for a closer guess, which over enough attempts
    tells a caller how much of a token they have right.
    """
    if not supplied:
        return None
    found = None
    for candidate in accepted:
        if secrets.compare_digest(supplied, candidate):
            found = candidate
    return found


def require_access_token(
    settings: Annotated[Settings, Depends(get_settings)],
    x_app_token: Annotated[Optional[str], Header()] = None,
) -> None:
    """Gate a route behind ``APP_ACCESS_TOKENS`` when any are configured.

    A no-op when the setting is empty, which is the local default. Attached to
    every router in ``main.py`` except health, so a deployment can be closed to
    strangers without any per-route bookkeeping.
    """
    accepted = settings.access_tokens
    if not accepted:
        return
    if _matching_token(x_app_token, accepted) is None:
        raise HTTPException(status_code=401, detail="Missing or invalid x-app-token")


@lru_cache
def _get_limiter(limit: int) -> FixedWindowLimiter:
    """One limiter per configured limit, shared across requests."""
    return FixedWindowLimiter(limit)


def client_identity(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    x_app_token: Annotated[Optional[str], Header()] = None,
) -> str:
    """Who to charge a rate-limited request to.

    The token when one matched, otherwise the peer address. Tokens are the
    better key wherever they exist: an IP is shared by everyone behind one NAT,
    so a seminar room on university wifi would otherwise share a single
    allowance between all of it. Issue one token per participant and each gets
    their own; a single shared token still leaves everyone in one bucket, which
    is the reason the setting is a list.

    The token is hashed rather than used raw so that a credential does not end
    up as a dictionary key in a memory dump or a debug log.
    """
    token = _matching_token(x_app_token, settings.access_tokens)
    if token:
        return "t:" + hashlib.sha256(token.encode()).hexdigest()[:16]
    return "ip:" + (request.client.host if request.client else "unknown")


def _enforce_rate_limit(settings: Settings, bucket: str, identity: str) -> None:
    """Charge one request against ``bucket`` for ``identity``, or raise 429.

    ``bucket`` namespaces the counter so that the LLM endpoints and the rethon
    simulation get separate allowances of the same size — running a simulation
    should not use up the budget for asking for suggestions.
    """
    limiter = _get_limiter(settings.rate_limit_per_minute)
    key = f"{bucket}:{identity}"
    if not limiter.allow(key):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded ({limiter.limit} requests per minute).",
            headers={"Retry-After": str(limiter.retry_after(key))},
        )


def rate_limit_simulation(
    settings: Annotated[Settings, Depends(get_settings)],
    identity: Annotated[str, Depends(client_identity)],
) -> None:
    """Cap rethon simulations per caller.

    The simulation is the most expensive thing this server does — it runs to a
    fixed point on a worker thread and is CPU-bound — so it needs a limit for
    reasons that have nothing to do with API keys. Attached to the router in
    ``main.py``.
    """
    _enforce_rate_limit(settings, "simulate", identity)


def get_llm_service(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    identity: Annotated[str, Depends(client_identity)],
    x_api_key: Annotated[Optional[str], Header()] = None,
    x_base_url: Annotated[Optional[str], Header()] = None,
    x_model: Annotated[Optional[str], Header()] = None,
) -> LLMService:
    """Construct an ``LLMService``, preferring BYOK headers over server settings.

    Injected by FastAPI into every endpoint that declares an
    ``Annotated[LLMService, Depends(get_llm_service)]`` parameter, which is also
    why the rate limit lives here: every path that can spend an API key passes
    through this function, so there is no way to add an LLM endpoint that
    forgets to be limited.

    Override in tests with ``app.dependency_overrides[get_llm_service]``.
    """
    if not x_base_url:
        raise HTTPException(status_code=400, detail="Missing x-base-url header")
    if x_base_url not in ALLOWED_BASE_URLS:
        raise HTTPException(status_code=400, detail="Unsupported provider URL")

    _enforce_rate_limit(settings, "llm", identity)

    if not x_api_key:
        if not settings.server_keys_allowed:
            raise HTTPException(
                status_code=403,
                detail="This server does not lend out API keys; supply your own.",
            )
        # request.client is the socket peer, so this cannot be spoofed by a
        # header — but behind a reverse proxy the peer is the proxy. See
        # Settings.allow_loopback_server_keys.
        #
        # Absent peer means we cannot establish the caller is local, so refuse:
        # this used to default to 127.0.0.1, which failed open.
        if request.client is None or request.client.host not in _LOOPBACK:
            raise HTTPException(
                status_code=403,
                detail="Server-side API keys are only accessible from localhost",
            )
    api_key = x_api_key or settings.llm_api_keys.get(x_base_url)
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured")
    config = LLMConfig(
        api_key=api_key,
        base_url=x_base_url,
        model=x_model or settings.default_model,
        max_tokens=settings.llm_max_tokens,
    )
    return LLMService(config)
