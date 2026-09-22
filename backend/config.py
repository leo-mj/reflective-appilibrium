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
from pathlib import Path  # used to locate the .env file
from typing import Literal, Optional
from urllib.parse import urlsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent / ".env"

Deployment = Literal["local", "hosted"]

# What each mode implies, when the corresponding setting is left unset.
#
#                              local            hosted
# server-side API keys         lent to loopback  never (BYOK only)
# LLM rate limit               none              60/min per caller
# simulation rate limit        none              5/min per caller
# stepping rate limit          none              30/min per caller
# scoring rate limit           none              300/min per caller
# LLM call timeout             600s (SDK)        90s
# rethon computation timeout   none              60s
# session storage on disk      on                off (browser keeps state)
#
# Four limits rather than one, because the endpoints they cover cost wildly
# different amounts and are reached in wildly different ways.
#
# An LLM call is one outbound request that mostly waits. A full simulation runs a
# BDD to a fixed point and holds the interpreter while it does, so a handful a
# minute is already generous.
#
# Stepping is the awkward middle. /step costs about what /simulate costs — it
# rebuilds the structure on every call — but it is the one endpoint whose entire
# purpose is to be pressed repeatedly: a reader walking an RE process forward
# does it one step at a time, and an evolution runs to as many steps as it takes.
# Charged against the simulation allowance it was unusable by its sixth press.
#
# Scoring is the other extreme: /quick_score and /score_changes are not
# user-initiated at all. The frontend fires quick_score from useScoreBaseline on
# every edit AND once per suggestion card from ScoreDeltaBadge — so a tab showing
# nine suggestions makes ten calls, and accepting one re-fires all ten because
# state.elements is in the dependency array. There is no debounce anywhere on
# that path. 300 is a runaway guard; anything near the real fan-out would blank
# the badges of someone simply working through a list.
_HOSTED_LLM_LIMIT = 60
_HOSTED_SIMULATION_LIMIT = 5
_HOSTED_STEPPING_LIMIT = 30
_HOSTED_SCORING_LIMIT = 300

# Short hosted, where every held connection is a visitor waiting on the single
# worker. Locally the SDKs' own default: the targets include quantized models on a
# consumer GPU, and a long relation-detection reply there is slow, not stuck.
_HOSTED_LLM_TIMEOUT = 90.0
_SDK_DEFAULT_LLM_TIMEOUT = 600.0

# The other half of restraining the simulation, and the half a rate limit cannot
# reach: the cost of one request rather than how many are allowed.
#
# Every one of these computations enumerates the consistent complete positions of
# a dialectical structure over the sentence pool, and that count grows like the
# Fibonacci numbers in the element count — roughly x1.6 per element. Measured on
# a development machine, for a chain of two-premise arguments:
#
#     n=20   1.0s      n=24   8.0s      n=26  21.4s
#     n=22   2.8s      n=25  13.1s      n=28  >30s
#
# A rate limit of 5/min is no protection against any of those; 200, which is what
# the schema permits, is not a long wait but an unbounded one.
#
# 20 rather than 25 because of what a slow request costs *other* callers — which
# is waiting, not a frozen server. An earlier version of this comment said a long
# computation froze the event loop; measured, it does not: rethon is pure Python,
# the interpreter hands the GIL back every few milliseconds, and a 16-second
# simulation in a thread stalled the loop by at most 0.1s. The real cost is that
# rethon computations run in single-worker pools (process_pool), so one large
# request holds up every other visitor's computation of the same kind for as long
# as it runs. Set where a request stays about a second. The timeout below now
# bounds the worst case, so this can be raised; each element added roughly
# multiplies how long everyone behind a large request may wait, up to that bound.
_HOSTED_MAX_ELEMENTS = 20

# Seconds a single rethon computation may run before its worker is killed and
# the caller gets a 504. What lets a cap above be wrong without a request running
# forever. Seconds of computing, not of queueing; a /score_per_round request is
# one computation, however many rounds it simulates. None locally, where the one
# caller can watch a long simulation and decide for themselves.
_HOSTED_COMPUTATION_TIMEOUT = 60.0


class Settings(BaseSettings):
    """Pydantic-settings model for the backend configuration.

    All fields can be overridden via environment variables or the .env file.

    The ``Optional`` fields below mean "follow ``deployment``" when unset. Read
    them through the resolved properties (``server_keys_allowed``,
    ``llm_rate_limit``, ``simulation_rate_limit``, ``scoring_rate_limit``)
    rather than directly, or the mode is silently ignored.
    """

    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    # ── The posture ───────────────────────────────────────────────────────────

    deployment: Deployment = "local"

    # ── Provider access ───────────────────────────────────────────────────────

    llm_api_keys: dict[str, str] = {}
    default_model: str = "gpt-4o-mini"
    cors_origins: str = "http://localhost:5173"

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

    # Per-caller caps per minute, one bucket each. 0 disables that bucket.
    #
    # The LLM cap applies to bring-your-own-key callers too: an unmetered relay
    # costs request volume aimed at the provider through us, not only the key.
    llm_rate_limit_per_minute: Optional[int] = None

    # /simulate and /score_per_round — the endpoints that run a process to a
    # fixed point in one request. Small on purpose; see the table above.
    simulation_rate_limit_per_minute: Optional[int] = None

    # /step alone. Same cost per call as a simulation, but pressed once per step
    # by a reader walking the process forward, so it needs room to be used.
    stepping_rate_limit_per_minute: Optional[int] = None

    # /quick_score and /score_changes, which the frontend fires on every edit.
    # Set this high or not at all: it is a runaway guard, not a quota.
    scoring_rate_limit_per_minute: Optional[int] = None

    # Largest sentence pool any rethon computation will accept. 0 disables the
    # cap, which is right on a machine whose only user can watch it work and
    # wrong anywhere a stranger can send a payload.
    max_simulation_elements: Optional[int] = None

    # Seconds one rethon computation may run; 0 disables the limit.
    simulation_timeout_seconds: Optional[float] = Field(default=None, ge=0)

    # ── Simulation workers ────────────────────────────────────────────────────

    # Worker processes for rethon computations, in two pools — see process_pool.
    # Full simulations (/simulate, /step, /score_per_round) and score lookups
    # (/quick_score, /score_changes) are kept apart so the badges never queue
    # behind a simulation. One each is right almost everywhere: the workers exist
    # so a computation can be stopped, not to run several at once, and each holds
    # its own copy of rethon in memory. Raising one lets that many of its kind run
    # at the same time, at a core each.
    simulation_workers: int = Field(default=1, ge=1)
    scoring_workers: int = Field(default=1, ge=1)

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

    # Seconds one provider call may take; each retry gets its own. Follows
    # DEPLOYMENT when unset — see the table above. Connecting is capped at 10s
    # regardless, in services.llm.
    llm_timeout_seconds: Optional[float] = None

    # Retries on connection errors, 429 and 5xx. The SDKs default to 2, which
    # triples a timeout before anyone sees an error.
    llm_max_retries: int = 1

    # ── Validation ────────────────────────────────────────────────────────────

    @field_validator("cors_origins")
    @classmethod
    def no_wildcard(cls, v: str) -> str:
        if any(o.strip() == "*" for o in v.split(",")):
            raise ValueError(
                "Wildcard '*' is not permitted in CORS_ORIGINS; list specific origins explicitly."
            )
        return v

    @field_validator("cors_origins")
    @classmethod
    def origins_not_urls(cls, v: str) -> str:
        """Each entry must be exactly ``scheme://host[:port]``.

        Starlette compares the browser's ``Origin`` header, which never carries a
        path, against these strings verbatim. So the natural thing to paste for a
        GitHub Pages site — ``https://user.github.io/repo`` — or even a trailing
        slash never matches, and every request fails CORS with nothing in the
        server log to say why.
        """
        for origin in (o.strip() for o in v.split(",")):
            if not origin or origin == "*":
                continue
            parts = urlsplit(origin)
            if (
                parts.scheme not in ("http", "https")
                or not parts.netloc
                or parts.path
                or parts.query
                or parts.fragment
            ):
                raise ValueError(
                    f"CORS_ORIGINS entry {origin!r} is not an origin: give "
                    "scheme://host[:port] with no path or trailing slash, e.g. "
                    "https://user.github.io rather than https://user.github.io/repo."
                )
        return v

    # ── Resolved values ───────────────────────────────────────────────────────

    @property
    def is_hosted(self) -> bool:
        return self.deployment == "hosted"

    @property
    def cors_origins_list(self) -> list[str]:
        """Return ``cors_origins`` as a list, split on commas.

        Empty when the setting is: a backend behind the same host as its page —
        one proxy routing ``/api`` to it — has no cross-origin callers to allow.
        """
        return [o for o in (o.strip() for o in self.cors_origins.split(",")) if o]

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
    def llm_rate_limit(self) -> int:
        """LLM requests per minute per caller; 0 means unlimited.

        Unlimited locally: the only caller is the person running the server, and
        a cap there is friction protecting no one. The same is true of the two
        below.
        """
        if self.llm_rate_limit_per_minute is not None:
            return self.llm_rate_limit_per_minute
        return _HOSTED_LLM_LIMIT if self.is_hosted else 0

    @property
    def llm_timeout(self) -> float:
        """Seconds one provider call may take before it is abandoned."""
        if self.llm_timeout_seconds is not None:
            return self.llm_timeout_seconds
        return _HOSTED_LLM_TIMEOUT if self.is_hosted else _SDK_DEFAULT_LLM_TIMEOUT

    @property
    def simulation_rate_limit(self) -> int:
        """Rethon simulations per minute per caller; 0 means unlimited."""
        if self.simulation_rate_limit_per_minute is not None:
            return self.simulation_rate_limit_per_minute
        return _HOSTED_SIMULATION_LIMIT if self.is_hosted else 0

    @property
    def stepping_rate_limit(self) -> int:
        """``/step`` calls per minute per caller; 0 means unlimited.

        Its own allowance because stepping is inherently repeated: one press is
        one request, and an evolution takes as many steps as it takes. Sharing
        the simulation bucket made the stepper refuse its sixth press, which is
        the same mistake splitting the scoring bucket out of it corrected.
        """
        if self.stepping_rate_limit_per_minute is not None:
            return self.stepping_rate_limit_per_minute
        return _HOSTED_STEPPING_LIMIT if self.is_hosted else 0

    @property
    def scoring_rate_limit(self) -> int:
        """Score lookups per minute per caller; 0 means unlimited.

        Deliberately far above the other two. These endpoints decorate the UI
        rather than answering a request anyone made, and the client turns a
        failure into a blank badge rather than an error — so a cap that bites is
        invisible to the person it is biting.
        """
        if self.scoring_rate_limit_per_minute is not None:
            return self.scoring_rate_limit_per_minute
        return _HOSTED_SCORING_LIMIT if self.is_hosted else 0

    @property
    def simulation_max_elements(self) -> int:
        """Largest sentence pool a rethon computation will accept; 0 = unlimited.

        Unlimited locally for the same reason the caps above are: the only caller
        is the person running the server, who can see the request take minutes
        and decide for themselves whether to wait. Nobody else can.
        """
        if self.max_simulation_elements is not None:
            return self.max_simulation_elements
        return _HOSTED_MAX_ELEMENTS if self.is_hosted else 0

    @property
    def simulation_timeout(self) -> float:
        """Seconds a rethon computation may run before it is stopped; 0 = none."""
        if self.simulation_timeout_seconds is not None:
            return self.simulation_timeout_seconds
        return _HOSTED_COMPUTATION_TIMEOUT if self.is_hosted else 0


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings (reads .env on first call)."""
    return Settings()
