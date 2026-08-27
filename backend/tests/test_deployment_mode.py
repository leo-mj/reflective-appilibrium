"""``DEPLOYMENT=local|hosted`` and the four protections it derives.

Whether the backend is reachable by anyone but its operator cannot be detected
at runtime, so it is declared — and getting it wrong is the difference between a
local tool and an open LLM relay. These tests pin what each mode implies, and
that an explicit setting still wins over the mode.
"""

import pytest
from fastapi.testclient import TestClient

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


def test_local_lends_keys_runs_unlimited_and_stores_sessions():
    s = make_settings()
    assert s.server_keys_allowed is True
    assert s.rate_limit_per_minute == 0
    assert s.sessions_on is True


def test_hosted_flips_all_three():
    s = make_settings(deployment="hosted")
    assert s.server_keys_allowed is False
    assert s.rate_limit_per_minute == 60
    assert s.sessions_on is False


def test_an_unknown_deployment_value_is_rejected():
    with pytest.raises(Exception):
        make_settings(deployment="staging")


# ── Explicit settings still win ───────────────────────────────────────────────


@pytest.mark.parametrize(
    "field, value, prop, expected",
    [
        ("allow_loopback_server_keys", True, "server_keys_allowed", True),
        ("llm_rate_limit_per_minute", 5, "rate_limit_per_minute", 5),
        ("llm_rate_limit_per_minute", 0, "rate_limit_per_minute", 0),
        ("sessions_enabled", True, "sessions_on", True),
    ],
)
def test_hosted_defaults_can_be_overridden(field, value, prop, expected):
    s = make_settings(deployment="hosted", **{field: value})
    assert getattr(s, prop) == expected


@pytest.mark.parametrize(
    "field, value, prop, expected",
    [
        ("allow_loopback_server_keys", False, "server_keys_allowed", False),
        ("llm_rate_limit_per_minute", 10, "rate_limit_per_minute", 10),
        ("sessions_enabled", False, "sessions_on", False),
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


# ── Session storage follows the mode ──────────────────────────────────────────


def a_state() -> dict:
    return {
        "topic": "t",
        "round": 1,
        "elements": [],
        "relations": [],
        "coherence": {"tensions": [], "orphans": [], "clusters": []},
        "log": [],
    }


@pytest.mark.parametrize(
    "method, path",
    [
        ("get", "/api/sessions"),
        ("get", "/api/sessions/anything"),
        ("delete", "/api/sessions/anything"),
    ],
)
def test_hosted_refuses_to_read_or_delete_sessions(method, path):
    try:
        client = _client_with(make_settings(deployment="hosted"))
        res = getattr(client, method)(path)
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 403


def test_hosted_refuses_to_write_a_session():
    """Nothing of a participant's reasoning is written to a shared machine."""
    try:
        client = _client_with(make_settings(deployment="hosted"))
        res = client.post("/api/sessions", json=a_state())
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 403


def test_the_refusal_tells_the_user_where_their_work_is():
    try:
        client = _client_with(make_settings(deployment="hosted"))
        detail = client.get("/api/sessions").json()["detail"]
    finally:
        app.dependency_overrides.clear()
    assert "browser" in detail and "Export" in detail


def test_a_hosted_instance_may_still_opt_into_disk_storage(tmp_path):
    try:
        client = _client_with(
            make_settings(
                deployment="hosted", sessions_enabled=True, sessions_dir=str(tmp_path)
            )
        )
        assert client.get("/api/sessions").status_code == 200
    finally:
        app.dependency_overrides.clear()


# ── Health advertises the capability ──────────────────────────────────────────


def test_health_reports_the_mode_and_session_capability():
    """This is how the browser knows whether to offer save and load at all."""
    try:
        local = _client_with(make_settings()).get("/api/health").json()
    finally:
        app.dependency_overrides.clear()
    assert local["deployment"] == "local"
    assert local["sessions"] is True

    try:
        hosted = (
            _client_with(make_settings(deployment="hosted")).get("/api/health").json()
        )
    finally:
        app.dependency_overrides.clear()
    assert hosted["deployment"] == "hosted"
    assert hosted["sessions"] is False


def test_health_needs_no_token_even_when_one_is_configured():
    try:
        client = _client_with(
            make_settings(deployment="hosted", app_access_tokens="s3cret")
        )
        assert client.get("/api/health").status_code == 200
    finally:
        app.dependency_overrides.clear()


# ── Rate-limit identity ───────────────────────────────────────────────────────


def _identity(settings, host, token=None):
    class _Client:
        pass

    _Client.host = host

    class _Request:
        client = _Client()

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


# ── Separate allowances per feature ───────────────────────────────────────────


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

        # The simulation allowance is untouched: a malformed body gets as far as
        # request validation (422), not the rate limiter (429).
        assert (
            client.post("/api/simulate_rethon/quick_score", json={}).status_code == 422
        )
    finally:
        app.dependency_overrides.clear()


def test_simulations_are_rate_limited():
    settings = make_settings(deployment="hosted", llm_rate_limit_per_minute=3)
    try:
        client = _client_with(settings)
        codes = [
            client.post("/api/simulate_rethon/quick_score", json={}).status_code
            for _ in range(5)
        ]
    finally:
        app.dependency_overrides.clear()
    # The first three get through to validation; the rest are refused earlier.
    assert codes[:3] == [422, 422, 422]
    assert codes[3:] == [429, 429]


def test_simulations_are_unlimited_locally():
    try:
        client = _client_with(make_settings())
        codes = {
            client.post("/api/simulate_rethon/quick_score", json={}).status_code
            for _ in range(80)
        }
    finally:
        app.dependency_overrides.clear()
    assert codes == {422}
