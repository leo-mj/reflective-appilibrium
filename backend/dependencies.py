"""
Shared FastAPI dependencies.

Each `get_*` function can be overridden in tests via `app.dependency_overrides`.
"""

import hashlib
import logging
import secrets
from functools import lru_cache
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, Request

from .config import Settings, get_settings
from .ratelimit import FixedWindowLimiter
from .services.llm import LLMConfig, LLMService

# Must stay in sync with LLM_PROVIDERS in app/src/constants/llmProviders.js.
# This is the security boundary — the frontend list is UX only.
ALLOWED_BASE_URLS = {
    "https://api.openai.com/v1",
    "https://api.mistral.ai/v1",
    "https://api.anthropic.com/v1",
    "http://localhost:11434/v1",
}

logger = logging.getLogger(__name__)


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
    host = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("x-forwarded-for")
    if settings.trusted_proxy_hops:
        return "ip:" + caller_address(forwarded_for, host, settings.trusted_proxy_hops)
    if settings.is_hosted:
        _warn_if_proxy_untrusted(forwarded_for, host)
    return "ip:" + host


def forwarded_hosts(forwarded_for: Optional[str]) -> list[str]:
    """The addresses in an ``x-forwarded-for`` header, in order, blanks dropped."""
    if not forwarded_for:
        return []
    return [h for h in (h.strip() for h in forwarded_for.split(",")) if h]


def caller_address(forwarded_for: Optional[str], peer: str, hops: int) -> str:
    """The address ``hops`` trusted proxies say they received the request from.

    Read from the right, because each proxy appends the address it saw: the
    last ``hops`` entries were written by proxies we trust, and the one furthest
    left of those is the caller as the outermost of them saw it. Anything
    further left was sent by the caller and is worth nothing — taking the
    leftmost entry, as uvicorn does when told to trust every proxy, let a caller
    pick a fresh rate-limit identity per request.

    A header shorter than ``hops`` did not pass through that many proxies, so
    it says nothing trustworthy and the socket peer is used instead.
    """
    hosts = forwarded_hosts(forwarded_for)
    if len(hosts) < hops:
        return peer
    return hosts[-hops]


_proxy_warning_logged = False


def untrusted_proxy_evident(forwarded_for: Optional[str], peer: str) -> bool:
    """Whether a request shows a proxy in front that uvicorn does not trust.

    When uvicorn trusts the proxy it replaces the peer with an address taken
    from ``x-forwarded-for`` — but leaves the header in place, so the header's
    presence alone proves nothing. A peer that is *not* among the forwarded
    addresses does: something forwarded this request and uvicorn ignored it.
    The rate limiter is then charging every visitor to the proxy's address.
    """
    if not forwarded_for:
        return False
    return peer not in forwarded_hosts(forwarded_for)


def _warn_if_proxy_untrusted(forwarded_for: Optional[str], peer: str) -> None:
    """Log the misconfiguration once per process rather than once per request."""
    global _proxy_warning_logged
    if _proxy_warning_logged or not untrusted_proxy_evident(forwarded_for, peer):
        return
    _proxy_warning_logged = True
    logger.warning(
        "Request from %s carries x-forwarded-for, but uvicorn is not trusting it: "
        "every visitor behind this proxy shares one rate-limit allowance. Set "
        "TRUSTED_PROXY_HOPS to the number of proxies in front (1 on Cloud Run), or "
        "run uvicorn with --forwarded-allow-ips=<proxy address>. (A client sending "
        "the header directly, with no proxy in front, also triggers this once.)",
        peer,
    )


def proxy_startup_warning(settings: Settings) -> Optional[str]:
    """The warning ``main.py`` logs at startup, or None when it does not apply.

    Hosted, with any rate limit on and no access tokens, every caller is charged
    to its peer address — which behind an untrusted proxy is the proxy, for all
    of them. Nothing at startup can tell whether a proxy is there, so this says
    what to check. Tokens make it moot: a matched token is the identity.
    """
    limits = (
        settings.llm_rate_limit,
        settings.simulation_rate_limit,
        settings.stepping_rate_limit,
        settings.scoring_rate_limit,
    )
    if (
        not settings.is_hosted
        or not any(limits)
        or settings.access_tokens
        or settings.trusted_proxy_hops
    ):
        return None
    return (
        "Hosted with rate limits on, no APP_ACCESS_TOKENS and no "
        "TRUSTED_PROXY_HOPS: callers are identified by peer address. Behind a "
        "reverse proxy, set TRUSTED_PROXY_HOPS to the number of proxies in front "
        "(1 on Cloud Run), or every visitor shares one allowance."
    )


def _enforce_rate_limit(limit: int, bucket: str, identity: str) -> None:
    """Charge one request against ``bucket`` for ``identity``, or raise 429.

    ``bucket`` namespaces the counter and ``limit`` sizes it, and the two are
    passed separately so that the three allowances are visibly independent at
    every call site. They used to share one number, which made "separate
    allowances" true of the counters and false of the ceilings.
    """
    limiter = _get_limiter(limit)
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
    fixed point and holds the interpreter while it does — so it needs a limit for
    reasons that have nothing to do with API keys. Attached to the expensive
    router in ``main.py``.
    """
    _enforce_rate_limit(settings.simulation_rate_limit, "simulate", identity)


def rate_limit_stepping(
    settings: Annotated[Settings, Depends(get_settings)],
    identity: Annotated[str, Depends(client_identity)],
) -> None:
    """Cap ``/step`` per caller, on its own allowance.

    One press of the stepper is one request, and a reader walks an evolution
    forward as many steps as it takes — so this endpoint is expensive per call
    *and* called repeatedly, which no single bucket can express alongside
    ``/simulate``. Attached to the stepping router in ``main.py``.
    """
    _enforce_rate_limit(settings.stepping_rate_limit, "step", identity)


def rate_limit_scoring(
    settings: Annotated[Settings, Depends(get_settings)],
    identity: Annotated[str, Depends(client_identity)],
) -> None:
    """Cap score lookups per caller.

    Its own bucket, and a much larger one, because these endpoints are not
    user-initiated: the frontend fires ``/quick_score`` on every change to an
    element, a relation or the weights, and ``simulateRethonClient`` turns any
    failure into ``null`` — a blank badge, with nothing said. Charged against the
    simulation allowance, as they were, a cap small enough to restrain
    ``/simulate`` would have silently emptied the score badges of anyone editing
    at a normal pace. Attached to the scoring router in ``main.py``.
    """
    _enforce_rate_limit(settings.scoring_rate_limit, "score", identity)


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

    _enforce_rate_limit(settings.llm_rate_limit, "llm", identity)

    if not x_api_key:
        if not settings.server_keys_allowed:
            raise HTTPException(
                status_code=403,
                detail="This server does not lend out API keys; supply your own.",
            )
        # request.client is the socket peer under plain uvicorn — but behind a
        # reverse proxy the peer is the proxy, and under
        # --forwarded-allow-ips="*" it has already been overwritten from
        # x-forwarded-for, so "x-forwarded-for: 127.0.0.1" reads as local. So
        # every address in the forwarded chain must be loopback too: a real
        # remote caller behind any proxy appears in it. See
        # Settings.allow_loopback_server_keys.
        #
        # Absent peer means we cannot establish the caller is local, so refuse:
        # this used to default to 127.0.0.1, which failed open.
        forwarded = forwarded_hosts(request.headers.get("x-forwarded-for"))
        if (
            request.client is None
            or request.client.host not in _LOOPBACK
            or any(h not in _LOOPBACK for h in forwarded)
        ):
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
        timeout_seconds=settings.llm_timeout,
        max_retries=settings.llm_max_retries,
    )
    return LLMService(config)
