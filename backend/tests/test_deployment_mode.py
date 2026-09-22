"""``DEPLOYMENT=local|hosted`` and the four protections it derives.

Whether the backend is reachable by anyone but its operator cannot be detected
at runtime, so it is declared — and getting it wrong is the difference between a
local tool and an open LLM relay. These tests pin what each mode implies, and
that an explicit setting still wins over the mode.
"""

import pytest
from fastapi.testclient import TestClient

from backend import dependencies
from backend.config import get_settings
from backend.dependencies import client_identity
from backend.main import app
from backend.tests.conftest import make_settings


def _client_with(settings) -> TestClient:
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app)


# ── What each mode implies ────────────────────────────────────────────────────


def test_local_is_the_default():
    assert make_settings().deployment == "local"


def test_local_lends_keys_and_runs_unlimited():
    s = make_settings()
    assert s.server_keys_allowed is True
    assert s.llm_rate_limit == 0
    assert s.simulation_rate_limit == 0
    assert s.stepping_rate_limit == 0
    assert s.scoring_rate_limit == 0


def test_hosted_flips_them():
    s = make_settings(deployment="hosted")
    assert s.server_keys_allowed is False
    assert s.llm_rate_limit == 60


def test_hosted_caps_the_four_features_separately():
    """The sizes differ by orders of magnitude, and are meant to.

    A simulation holds the interpreter to a fixed point; /step costs the same but
    is pressed once per step; a score lookup is analytic and fired once per
    suggestion card. One number across them is what made lowering the simulation
    cap a way to blank the score badges — and then a way to stop the stepper.
    """
    s = make_settings(deployment="hosted")
    assert s.llm_rate_limit == 60
    assert s.simulation_rate_limit == 5
    assert s.stepping_rate_limit == 30
    assert s.scoring_rate_limit == 300


def test_stepping_is_not_charged_against_the_simulation_allowance():
    """Stepping is repeated by design: one press, one request, as many presses as
    the evolution has steps. Charged against /simulate's five a minute, the
    stepper refused its sixth press."""
    settings = make_settings(deployment="hosted", simulation_rate_limit_per_minute=2)
    try:
        client = _client_with(settings)
        for _ in range(2):
            assert client.post(_SIMULATE, json={}).status_code == 422
        assert client.post(_SIMULATE, json={}).status_code == 429

        codes = {
            client.post("/api/simulate_rethon/step", json={}).status_code
            for _ in range(10)
        }
        assert codes == {422}
    finally:
        app.dependency_overrides.clear()


def test_the_llm_timeout_follows_the_mode():
    """Short where a held connection is a stranger waiting; the SDK's own where
    the caller may be a quantized model on a consumer GPU, slow but not stuck."""
    assert make_settings(deployment="hosted").llm_timeout == 90
    assert make_settings().llm_timeout == 600
    assert make_settings(deployment="hosted", llm_timeout_seconds=30).llm_timeout == 30


def test_the_llm_service_is_built_with_the_timeout_and_retries(mock_llm_complete):
    """Checked through the real dependency, not an override of it."""
    settings = make_settings(deployment="hosted", llm_max_retries=0)
    headers = {"x-api-key": "k", "x-base-url": "https://api.openai.com/v1"}
    try:
        client = _client_with(settings)
        assert client.post("/api/llm/test", headers=headers).status_code == 200
    finally:
        app.dependency_overrides.clear()
    kwargs = mock_llm_complete.call_args.kwargs
    assert kwargs["max_retries"] == 0
    assert kwargs["timeout"].read == 90


def test_an_unknown_deployment_value_is_rejected():
    with pytest.raises(Exception):
        make_settings(deployment="staging")


# ── Explicit settings still win ───────────────────────────────────────────────


@pytest.mark.parametrize(
    "field, value, prop, expected",
    [
        ("allow_loopback_server_keys", True, "server_keys_allowed", True),
        ("llm_rate_limit_per_minute", 5, "llm_rate_limit", 5),
        ("llm_rate_limit_per_minute", 0, "llm_rate_limit", 0),
        ("simulation_rate_limit_per_minute", 50, "simulation_rate_limit", 50),
        ("simulation_rate_limit_per_minute", 0, "simulation_rate_limit", 0),
        ("stepping_rate_limit_per_minute", 7, "stepping_rate_limit", 7),
        ("stepping_rate_limit_per_minute", 0, "stepping_rate_limit", 0),
        ("scoring_rate_limit_per_minute", 10, "scoring_rate_limit", 10),
        ("scoring_rate_limit_per_minute", 0, "scoring_rate_limit", 0),
    ],
)
def test_hosted_defaults_can_be_overridden(field, value, prop, expected):
    s = make_settings(deployment="hosted", **{field: value})
    assert getattr(s, prop) == expected


@pytest.mark.parametrize(
    "field, value, prop, expected",
    [
        ("allow_loopback_server_keys", False, "server_keys_allowed", False),
        ("llm_rate_limit_per_minute", 10, "llm_rate_limit", 10),
        ("simulation_rate_limit_per_minute", 2, "simulation_rate_limit", 2),
        ("scoring_rate_limit_per_minute", 30, "scoring_rate_limit", 30),
    ],
)
def test_local_defaults_can_be_overridden(field, value, prop, expected):
    s = make_settings(**{field: value})
    assert getattr(s, prop) == expected


def test_a_local_install_is_not_rate_limited_end_to_end(mock_llm_complete):
    """The point of the mode: no cap on the machine you are sitting at."""
    headers = {"x-api-key": "k", "x-base-url": "https://api.openai.com/v1"}
    try:
        client = _client_with(make_settings())
        codes = {
            client.post("/api/llm/test", headers=headers).status_code
            for _ in range(120)
        }
    finally:
        app.dependency_overrides.clear()
    assert codes == {200}


# ── Nothing is written to disk, in either mode ────────────────────────────────


@pytest.mark.parametrize(
    "method, path",
    [
        ("post", "/api/sessions"),
        ("get", "/api/sessions"),
        ("get", "/api/sessions/anything"),
        ("delete", "/api/sessions/anything"),
    ],
)
def test_there_is_no_session_storage_endpoint(method, path):
    """Server-side session storage was removed, not gated.

    A gate is a setting away from writing strangers' moral reasoning to a
    shared machine's disk; a missing route is not. The browser keeps the
    working state and Markdown export is the way out of it.
    """
    try:
        client = _client_with(make_settings())
        res = getattr(client, method)(path)
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 404


# ── Health advertises the mode ────────────────────────────────────────────────


def test_health_reports_the_mode():
    try:
        local = _client_with(make_settings()).get("/api/health").json()
    finally:
        app.dependency_overrides.clear()
    assert local["deployment"] == "local"

    try:
        hosted = (
            _client_with(make_settings(deployment="hosted")).get("/api/health").json()
        )
    finally:
        app.dependency_overrides.clear()
    assert hosted["deployment"] == "hosted"


def test_health_needs_no_token_even_when_one_is_configured():
    try:
        client = _client_with(
            make_settings(deployment="hosted", app_access_tokens="s3cret")
        )
        assert client.get("/api/health").status_code == 200
    finally:
        app.dependency_overrides.clear()


# ── Rate-limit identity ───────────────────────────────────────────────────────


def _identity(settings, host, token=None, headers=None):
    class _Client:
        pass

    _Client.host = host

    class _Request:
        client = _Client()

    _Request.headers = headers or {}

    return client_identity(_Request(), settings, x_app_token=token)


def test_identity_falls_back_to_the_peer_address():
    s = make_settings()
    assert _identity(s, "10.0.0.4") == "ip:10.0.0.4"
    assert _identity(s, "10.0.0.4") != _identity(s, "10.0.0.5")


def test_distinct_tokens_get_distinct_buckets():
    """The reason the setting is a list.

    A seminar room shares one NAT address, so keying on IP would put a whole
    class in a single allowance. One token each separates them.
    """
    s = make_settings(app_access_tokens="alice,bob,carol")
    ids = {_identity(s, "10.0.0.4", t) for t in ("alice", "bob", "carol")}
    assert len(ids) == 3


def test_the_same_token_from_different_addresses_is_one_caller():
    s = make_settings(app_access_tokens="alice")
    assert _identity(s, "10.0.0.4", "alice") == _identity(s, "203.0.113.7", "alice")


def test_an_unrecognised_token_falls_back_to_the_address():
    s = make_settings(app_access_tokens="alice")
    assert _identity(s, "10.0.0.4", "not-a-token") == "ip:10.0.0.4"


def test_the_bucket_key_does_not_contain_the_token():
    """Keys end up in memory dumps and debug logs; credentials should not."""
    s = make_settings(app_access_tokens="super-secret-token")
    assert "super-secret-token" not in _identity(s, "10.0.0.4", "super-secret-token")


def test_tokens_are_parsed_as_a_trimmed_list():
    s = make_settings(app_access_tokens=" alice , bob ,, ")
    assert s.access_tokens == {"alice", "bob"}


def test_no_tokens_configured_means_an_empty_set():
    assert make_settings().access_tokens == set()


# ── An untrusted proxy in front ───────────────────────────────────────────────


@pytest.fixture
def fresh_proxy_warning(monkeypatch):
    monkeypatch.setattr(dependencies, "_proxy_warning_logged", False)


@pytest.mark.parametrize(
    "forwarded_for, peer, evident",
    [
        (None, "10.0.0.4", False),
        # uvicorn trusted the proxy: the peer was taken from the header.
        ("203.0.113.7", "203.0.113.7", False),
        ("203.0.113.7, 10.0.0.2", "203.0.113.7", False),
        # uvicorn ignored the header: the peer is the proxy itself.
        ("203.0.113.7", "10.0.0.2", True),
    ],
)
def test_an_untrusted_proxy_is_told_apart_from_a_trusted_one(
    forwarded_for, peer, evident
):
    """uvicorn rewrites the peer but leaves x-forwarded-for in place, so the
    header's presence alone would flag every correctly configured proxy too."""
    assert dependencies.untrusted_proxy_evident(forwarded_for, peer) is evident


def test_an_untrusted_proxy_is_logged_exactly_once(fresh_proxy_warning, caplog):
    s = make_settings(deployment="hosted")
    headers = {"x-forwarded-for": "203.0.113.7"}
    with caplog.at_level("WARNING", logger="backend.dependencies"):
        for _ in range(5):
            assert _identity(s, "10.0.0.2", headers=headers) == "ip:10.0.0.2"
    warnings = [r for r in caplog.records if "forwarded-allow-ips" in r.message]
    assert len(warnings) == 1


def test_a_local_instance_does_not_warn_about_proxies(fresh_proxy_warning, caplog):
    with caplog.at_level("WARNING", logger="backend.dependencies"):
        _identity(make_settings(), "10.0.0.2", headers={"x-forwarded-for": "1.2.3.4"})
    assert not caplog.records


def test_a_matched_token_makes_the_proxy_irrelevant(fresh_proxy_warning, caplog):
    s = make_settings(deployment="hosted", app_access_tokens="alice")
    with caplog.at_level("WARNING", logger="backend.dependencies"):
        _identity(s, "10.0.0.2", "alice", headers={"x-forwarded-for": "1.2.3.4"})
    assert not caplog.records


@pytest.mark.parametrize(
    "overrides, warns",
    [
        ({"deployment": "hosted"}, True),
        ({}, False),
        ({"deployment": "hosted", "app_access_tokens": "alice"}, False),
        (
            {
                "deployment": "hosted",
                "llm_rate_limit_per_minute": 0,
                "simulation_rate_limit_per_minute": 0,
                "stepping_rate_limit_per_minute": 0,
                "scoring_rate_limit_per_minute": 0,
            },
            False,
        ),
    ],
)
def test_startup_warns_only_where_callers_are_keyed_on_address(overrides, warns):
    warning = dependencies.proxy_startup_warning(make_settings(**overrides))
    assert (warning is not None) is warns


# ── Separate allowances per feature ───────────────────────────────────────────


# Every request below sends `json={}`, which fails request validation. That is
# the point: a 422 means the call reached validation, so the limiter let it
# through, and a 429 means it did not — and no simulation ever actually runs.
_SIMULATE = "/api/simulate_rethon/simulate"
_SCORE = "/api/simulate_rethon/quick_score"


def test_simulation_and_llm_do_not_share_an_allowance(mock_llm_complete):
    """Running a simulation should not use up the budget for asking for help."""
    settings = make_settings(deployment="hosted", llm_rate_limit_per_minute=2)
    headers = {"x-api-key": "k", "x-base-url": "https://api.openai.com/v1"}
    try:
        client = _client_with(settings)
        # Exhaust the LLM allowance.
        for _ in range(2):
            assert client.post("/api/llm/test", headers=headers).status_code == 200
        assert client.post("/api/llm/test", headers=headers).status_code == 429

        # The simulation allowance is untouched.
        assert client.post(_SIMULATE, json={}).status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_scoring_and_simulation_do_not_share_an_allowance():
    """The split this ticket exists for.

    The frontend fires /quick_score on every edit to an element, a relation or
    the weights, and turns any failure into a null — a blank badge, silently. So
    a simulation cap low enough to be worth having must not reach these two, or
    tightening the server makes the app look broken to someone merely typing.
    """
    settings = make_settings(
        deployment="hosted",
        simulation_rate_limit_per_minute=2,
        scoring_rate_limit_per_minute=50,
    )
    try:
        client = _client_with(settings)
        # Exhaust the simulation allowance.
        for _ in range(2):
            assert client.post(_SIMULATE, json={}).status_code == 422
        assert client.post(_SIMULATE, json={}).status_code == 429

        # Scoring keeps answering.
        codes = {client.post(_SCORE, json={}).status_code for _ in range(20)}
        assert codes == {422}
    finally:
        app.dependency_overrides.clear()


def test_simulations_are_rate_limited():
    settings = make_settings(deployment="hosted", simulation_rate_limit_per_minute=3)
    try:
        client = _client_with(settings)
        codes = [client.post(_SIMULATE, json={}).status_code for _ in range(5)]
    finally:
        app.dependency_overrides.clear()
    # The first three get through to validation; the rest are refused earlier.
    assert codes[:3] == [422, 422, 422]
    assert codes[3:] == [429, 429]


def test_scoring_is_rate_limited_too_just_far_higher():
    """A runaway guard, not a quota — but not absent."""
    settings = make_settings(deployment="hosted", scoring_rate_limit_per_minute=3)
    try:
        client = _client_with(settings)
        codes = [client.post(_SCORE, json={}).status_code for _ in range(5)]
    finally:
        app.dependency_overrides.clear()
    assert codes[:3] == [422, 422, 422]
    assert codes[3:] == [429, 429]


def test_simulations_are_unlimited_locally():
    try:
        client = _client_with(make_settings())
        codes = {client.post(_SIMULATE, json={}).status_code for _ in range(80)}
    finally:
        app.dependency_overrides.clear()
    assert codes == {422}


def test_scoring_is_unlimited_locally():
    try:
        client = _client_with(make_settings())
        codes = {client.post(_SCORE, json={}).status_code for _ in range(200)}
    finally:
        app.dependency_overrides.clear()
    assert codes == {422}
