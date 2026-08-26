"""
Application configuration loaded from the .env file adjacent to this module.

Settings are read once and cached; the LLM adapter and CORS policy are
controlled entirely by environment variables so the app can target any
OpenAI-compatible endpoint without code changes.

``DEPLOYMENT`` is the one setting that matters most. Whether the backend is
reachable by anyone other than the person running it cannot be detected —
``request.client`` is the socket peer, which behind a reverse proxy is the proxy
itself, usually on loopback — so it has to be declared, and four separate
protections follow from it. Setting it wrong is the difference between a
convenient local tool and an open LLM relay, which is why it is a single flag
rather than four independent ones to remember.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path  # used in default value for sessions_dir
from typing import Literal, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent / ".env"

Deployment = Literal["local", "hosted"]

# What each mode implies, when the corresponding setting is left unset.
#
#                              local            hosted
# server-side API keys         lent to loopback  never (BYOK only)
# LLM + simulation rate limit  none              60/min per caller
# session storage on disk      on                off (browser keeps state)
_HOSTED_RATE_LIMIT = 60


class Settings(BaseSettings):
    """Pydantic-settings model for the backend configuration.

    All fields can be overridden via environment variables or the .env file.

    The three ``Optional`` fields below mean "follow ``deployment``" when unset.
    Read them through the resolved properties (``server_keys_allowed``,
    ``rate_limit_per_minute``, ``sessions_enabled``) rather than directly, or the
    mode is silently ignored.
    """

    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    # ── The posture ───────────────────────────────────────────────────────────

    deployment: Deployment = "local"

    # ── Provider access ───────────────────────────────────────────────────────

    llm_api_keys: dict[str, str] = {}
    default_model: str = "gpt-4o-mini"
    cors_origins: str = "http://localhost:5173"
    sessions_dir: str = str(Path(__file__).parent.parent / "sessions")

    # Comma-separated. When non-empty, every /api route except /api/health
    # requires one of these values in an x-app-token header.
    #
    # A list rather than a single token so that a class or study can be issued
    # one token each: the rate limiter buckets by whichever token matched, so
    # distinct tokens give each participant their own allowance. A single shared
    # token authenticates fine but puts everyone in one bucket — see
    # dependencies.client_identity.
    app_access_tokens: str = ""

    # ── Mode-derived (None = follow `deployment`) ─────────────────────────────

    # Whether a caller that sends no key of its own may spend a server-side one.
    # The check is "is the socket peer on loopback", so it is only meaningful
    # when nothing sits in front of uvicorn.
    #
    # If you terminate at a proxy and still want the loopback rule, run uvicorn
    # with --forwarded-allow-ips set to the proxy's address so request.client
    # reflects the real caller, and set this to true explicitly.
    allow_loopback_server_keys: Optional[bool] = None

    # Per-caller cap per minute on LLM requests and on rethon simulations, which
    # get separate allowances of this size. 0 disables it. Applies to
    # bring-your-own-key callers too: an unmetered relay costs request volume
    # aimed at the provider through us, not only the key.
    llm_rate_limit_per_minute: Optional[int] = None

    # Whether /api/sessions may read and write session files on disk.
    sessions_enabled: Optional[bool] = None

    # ── Provider mechanics ────────────────────────────────────────────────────

    # ── Reference checking ────────────────────────────────────────────────────

    # Whether suggested references are checked against Crossref's public API.
    # On by default and in every deployment: an outbound HTTPS call to a keyless
    # public service works the same hosted, local and dev, which is the whole
    # reason the check is Crossref rather than the user's own library. Turn it
    # off for an air-gapped install, or a study whose protocol permits no
    # outbound traffic beyond the LLM provider — references then read as "not
    # checked", which is a distinct state from "not found".
    crossref_enabled: bool = True
    crossref_base_url: str = "https://api.crossref.org/works"
    crossref_timeout_seconds: float = 8.0

    # Self-identification for Crossref's "polite pool", which is more reliably
    # served than the anonymous one.
    #
    # This is the *operator's* address, set deliberately here, and it defaults to
    # empty so an unconfigured install stays anonymous. The address of whoever is
    # using the app is never sent: their email is not ours to hand to a third
    # party as a side effect of their asking for suggestions.
    crossref_mailto: str = ""

    # Output cap for a single Anthropic completion, which the Messages API
    # requires explicitly.  Not sent to OpenAI-compatible providers, which do
    # not require it and would be newly constrained by it.  The relation and
    # argument tasks scale their output with the element count, so a too-low
    # value truncates the reply mid-JSON; the service logs a warning when a
    # response stops at the cap.
    llm_max_tokens: int = 4096

    # ── Validation ────────────────────────────────────────────────────────────

    @field_validator("cors_origins")
    @classmethod
    def no_wildcard(cls, v: str) -> str:
        if any(o.strip() == "*" for o in v.split(",")):
            raise ValueError(
                "Wildcard '*' is not permitted in CORS_ORIGINS; list specific origins explicitly."
            )
        return v

    # ── Resolved values ───────────────────────────────────────────────────────

    @property
    def is_hosted(self) -> bool:
        return self.deployment == "hosted"

    @property
    def cors_origins_list(self) -> list[str]:
        """Return ``cors_origins`` as a list, split on commas."""
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def access_tokens(self) -> set[str]:
        """The accepted x-app-token values; empty means the gate is off."""
        return {t.strip() for t in self.app_access_tokens.split(",") if t.strip()}

    @property
    def server_keys_allowed(self) -> bool:
        """Whether a keyless caller may use a server-side key at all."""
        if self.allow_loopback_server_keys is not None:
            return self.allow_loopback_server_keys
        return not self.is_hosted

    @property
    def rate_limit_per_minute(self) -> int:
        """Requests per minute per caller; 0 means unlimited.

        Unlimited locally: the only caller is the person running the server, and
        a cap there is friction protecting no one.
        """
        if self.llm_rate_limit_per_minute is not None:
            return self.llm_rate_limit_per_minute
        return _HOSTED_RATE_LIMIT if self.is_hosted else 0

    @property
    def sessions_on(self) -> bool:
        """Whether the server persists sessions to disk.

        Off when hosted: storing other people's reasoning on a shared box makes
        the server a data controller, and the browser keeps the working state
        anyway. Local installs keep it — that is the researcher's own machine.
        """
        if self.sessions_enabled is not None:
            return self.sessions_enabled
        return not self.is_hosted


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings (reads .env on first call)."""
    return Settings()
