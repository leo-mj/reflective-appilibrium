"""
Application configuration loaded from the .env file adjacent to this module.

Settings are read once and cached; the LLM adapter and CORS policy are
controlled entirely by environment variables so the app can target any
OpenAI-compatible endpoint without code changes.

``DEPLOYMENT`` is the one setting that matters most. Whether the backend is
reachable by anyone other than the person running it cannot be detected —
``request.client`` is the socket peer, which behind a reverse proxy is the proxy
itself, usually on loopback — so it has to be declared, and every protection in
the table below follows from it. Setting it wrong is the difference between a
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
# loopback provider (Ollama)   accepted          refused (it is the server's)
# LLM rate limit               none              60/min per caller
# simulation rate limit        none              5/min per caller
# stepping rate limit          none              30/min per caller
# scoring rate limit           none              300/min per caller
# LLM call timeout             600s (SDK)        90s
# rethon computation timeout   none              60s
# rethon cap: elements argued  none              20
# rethon cap: elements in all  none              50
# rethon search depth          none (4)          2
# request body size            none              10 MiB
#
# Nothing is written to disk in either mode; the browser keeps the state.
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
# **What costs is the elements arguments tie together, not the element count.**
# Every one of these computations works over the consistent positions of a
# dialectical structure, and an element no argument mentions adds almost nothing
# to that: the BDD leaves it free. Where the elements are tied together the cost
# grows like the Fibonacci numbers — roughly x1.6 per element. Measured on a
# development machine, a full simulation:
#
#     chain of two-premise arguments, every element in one
#         n=20   5.4s      n=24  29.9s      n=28  over the 60s limit
#     the demo's processes, few elements in arguments
#         22 elements (10 argued)   0.08s
#         33 elements (13 argued)   0.24s    (the demo merged with its second)
#         50 elements (20 argued)   2.0s     (built from the two, as a test)
#
# So the cap that matters counts elements that take part in an argument, and it
# is set where the worst case, a dense chain, stays about five seconds. It was a
# cap of 20 on all elements, which refused the demo itself: 22 elements, ten
# of them in arguments.
#
# **Raised from 20 to 24 when the theory was restricted** to principles and
# background theories and seeded with the ones held (services/rethon_theory.py).
# Most of standard rethon's time went on scoring every theory candidate in the
# neighbourhood; restricted, most are never scored. Measured on one development
# machine, the same dense chain at depth 2, before and after, the worst of chains
# with every element, one in two and one in three a principle:
#
#     argued    before     after
#       20      20.8s      1.95s
#       22      72.6s      4.25s
#       24        —        15.3s
#       26        —        28.0s
#
# 24 keeps the worst case under what 20 allowed before on the same machine; past
# it the growth — still about x1.6 an element — takes it over the timeout soon.
# The restriction also filters nothing where every element is a principle, and
# that chain was no worse (3.99s at 22): starting from the held theory is what
# carries it there. "Argued" counts what rethon is given — the elements of
# its arguments (``RETHON_ARGUMENT_TYPES``) — since nothing else reaches it.
# The total gets a looser cap of its own, since an unargued element is cheap
# but not free — History's per-step scoring runs a simulation
# per step, and took 17s over 50 elements and 61 steps.
#
# A slow request costs *other* callers waiting, not a frozen server: rethon is
# pure Python, the interpreter hands the GIL back every few milliseconds, and a
# 16-second simulation in a thread stalled the event loop by at most 0.1s. But
# rethon computations run in single-worker pools (process_pool), so one large
# request holds up every other visitor's computation of the same kind for as
# long as it runs. The timeout below bounds that worst case.
_HOSTED_MAX_ARGUED_ELEMENTS = 24
_HOSTED_MAX_ELEMENTS = 50

# The neighbourhood depth of the local search: how far from the current position
# each step looks for a better one. The element caps bound how big the structure
# is; this bounds how much of it one step searches, and it grows faster than
# either. Measured on a hosted container, one Equilibrate:
#
#                          depth 1   depth 2   depth 3   depth 4
#     demo (22 elements)     2.0s      1.1s     12.9s    over 60s
#     merged demo (33)       2.1s      6.9s    over 60s  over 60s
#
# Depth 3 costs roughly ten times depth 2, which no faster machine closes, and
# a single Step at depth 3 took 39s — all of it time every other visitor's
# simulation spends queued behind it on the one worker. So hosted stops at 2.
# The Simulate tab reads the limit from /api/health and always searches at it,
# offering no choice: depth 1 finds too little to be worth one.
_HOSTED_MAX_NEIGHBOURHOOD_DEPTH = 2

# Seconds a single rethon computation may run before its worker is killed and
# the caller gets a 504. What lets a cap above be wrong without a request running
# forever. Seconds of computing, not of queueing; a /score_per_round request is
# one computation, however many rounds it simulates. None locally, where the one
# caller can watch a long simulation and decide for themselves.
_HOSTED_COMPUTATION_TIMEOUT = 60.0

# Largest request body, in bytes, refused before it is read (body_limit.py). The
# Pydantic caps bound each field, but only once the body has been parsed, on the
# one worker everyone shares.
#
# Sized from what is legitimately sent. Measured: the sample process merged with
# sample-process-climate-duties.md is 23 KB as JSON (33 elements, 43 relations,
# about 250 bytes each). A discussion at its caps adds about 1.2 MB of messages to
# its state. The largest any route's own caps admit, short of the state's nested
# histories, is /api/llm/complete — 100 messages of 100,000 characters, just
# under 10 MB. 10 MiB covers that, and matches client_max_body_size in the
# compose stack's nginx (app/nginx/default.conf.template), so the two agree.
_HOSTED_MAX_BODY_BYTES = 10 * 1024 * 1024


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
    # For API clients only: the web app never sends x-app-token, so an instance
    # the site talks to must leave this empty or the site is refused everywhere
    # but /api/health. See backend/.env.example.
    #
    # A list rather than a single token so that a class or study can be issued
    # one token each: the rate limiter buckets by whichever token matched, so
    # distinct tokens give each participant their own allowance. A single shared
    # token authenticates fine but puts everyone in one bucket — see
    # dependencies.client_identity.
    app_access_tokens: str = ""

    # How many proxies in front of uvicorn append to x-forwarded-for. With no
    # tokens, a rate-limited caller is identified by address, and this says
    # which address: the entry that many places from the *right* of the header,
    # the one the outermost trusted proxy wrote. 0 means use the socket peer and
    # read no header at all.
    #
    # Counted from the right because proxies append: everything left of what
    # they wrote is whatever the caller chose to send. uvicorn's
    # --forwarded-allow-ips="*" takes the *leftmost* entry instead, which is why
    # the image no longer passes it — under it, a caller rotating the header got
    # a fresh allowance on every request.
    #
    # Cloud Run, Fly and Render each put one proxy in front: 1. Behind a load
    # balancer that also appends, 2. Never set it on a port reachable directly,
    # where the caller writes the rightmost entry too.
    trusted_proxy_hops: int = Field(default=0, ge=0)

    # ── Mode-derived (None = follow `deployment`) ─────────────────────────────

    # Whether a caller that sends no key of its own may spend a server-side one.
    # The check is "is the socket peer on loopback", so it is only meaningful
    # when nothing sits in front of uvicorn.
    #
    # If you terminate at a proxy and still want the loopback rule, run uvicorn
    # with --forwarded-allow-ips set to the proxy's address so request.client
    # reflects the real caller, and set this to true explicitly. Never with
    # --forwarded-allow-ips="*": that takes request.client from the header, so
    # "x-forwarded-for: 127.0.0.1" would read as local. get_llm_service also
    # refuses any request whose forwarded chain names a non-loopback address.
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

    # Most elements that take part in arguments a rethon computation will
    # accept — the number its cost grows with. 0 disables the cap.
    max_argued_elements: Optional[int] = None

    # Deepest neighbourhood a simulation may search. 0 disables the cap, leaving
    # the request schema's own limit of 4.
    max_neighbourhood_depth: Optional[int] = Field(default=None, ge=0)

    # Seconds one rethon computation may run; 0 disables the limit.
    simulation_timeout_seconds: Optional[float] = Field(default=None, ge=0)

    # Bytes a request body may carry before it is refused with 413; 0 disables.
    max_request_body_bytes: Optional[int] = Field(default=None, ge=0)

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

    # ── Logging ───────────────────────────────────────────────────────────────

    # "text" for a person reading a terminal; "json" for a log collector — one
    # object per line, with a severity it can filter on and a traceback kept in
    # one entry. See logging_setup. Either way no exception's message is printed.
    log_format: Literal["text", "json"] = "text"

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
    def simulation_max_argued_elements(self) -> int:
        """Most elements in arguments a rethon computation will accept; 0 = unlimited.

        The cap that bounds the cost: see the note at ``_HOSTED_MAX_ARGUED_ELEMENTS``.
        """
        if self.max_argued_elements is not None:
            return self.max_argued_elements
        return _HOSTED_MAX_ARGUED_ELEMENTS if self.is_hosted else 0

    @property
    def simulation_max_depth(self) -> int:
        """Deepest neighbourhood a simulation may search; 0 = no cap beyond the
        schema's. See ``_HOSTED_MAX_NEIGHBOURHOOD_DEPTH``."""
        if self.max_neighbourhood_depth is not None:
            return self.max_neighbourhood_depth
        return _HOSTED_MAX_NEIGHBOURHOOD_DEPTH if self.is_hosted else 0

    @property
    def simulation_element_caps(self) -> "ElementCaps":
        """Both caps, as the rethon services take them."""
        from .services.rethon_caps import ElementCaps

        return ElementCaps(
            total=self.simulation_max_elements,
            argued=self.simulation_max_argued_elements,
        )

    @property
    def simulation_timeout(self) -> float:
        """Seconds a rethon computation may run before it is stopped; 0 = none."""
        if self.simulation_timeout_seconds is not None:
            return self.simulation_timeout_seconds
        return _HOSTED_COMPUTATION_TIMEOUT if self.is_hosted else 0

    @property
    def request_body_limit(self) -> int:
        """Bytes a request body may carry; 0 = unlimited.

        Unlimited locally for the reason the caps above are: the only sender is
        the person running the server, whose own payload cannot crowd anyone out.
        """
        if self.max_request_body_bytes is not None:
            return self.max_request_body_bytes
        return _HOSTED_MAX_BODY_BYTES if self.is_hosted else 0


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings (reads .env on first call)."""
    return Settings()
