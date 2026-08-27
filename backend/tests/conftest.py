import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import get_settings, Settings
from backend.dependencies import _get_limiter


def make_settings(**overrides) -> Settings:
    """Build Settings that ignore the developer's backend/.env.

    ``_env_file=None`` is not optional here. Without it the .env file still wins
    for fields the test does not name — and, because pydantic-settings does not
    treat an empty dict as an override, even ``llm_api_keys={}`` leaves the real
    keys in place. Tests would then run against whatever provider credentials
    happen to be on the machine, and pass or fail accordingly.
    """
    return Settings(_env_file=None, **overrides)


@pytest.fixture(autouse=True)
def isolate_from_the_environment():
    """Detach every test from the developer's machine.

    Two kinds of leakage, both of which produced tests whose result depended on
    the machine they ran on:

    Process-global caches. ``get_settings`` is lru_cached, and so is the rate
    limiter — whose counters outlive a request by design. Without clearing them,
    the suite shares one bucket keyed on "testclient", and once it had made
    enough LLM calls in a minute the rest would fail with 429s unrelated to what
    they test.

    The .env file. Any test that builds a TestClient without naming its own
    settings would otherwise read backend/.env, i.e. run against real provider
    keys and whatever access token happens to be configured locally. Overriding
    the dependency here makes isolation the default; a test that wants specific
    settings still assigns over this.
    """
    get_settings.cache_clear()
    _get_limiter.cache_clear()
    # A zero-arg lambda, not make_settings itself: FastAPI introspects an
    # override's signature, and make_settings' **overrides would be read as
    # request parameters, turning every gated route into a 422.
    app.dependency_overrides[get_settings] = lambda: make_settings()
    yield
    app.dependency_overrides.clear()
    get_settings.cache_clear()
    _get_limiter.cache_clear()


@pytest.fixture
def fake_settings():
    return make_settings(
        llm_api_keys={"https://api.openai.com/v1": "server-key"},
        default_model="gpt-4o-mini",
    )


@pytest.fixture
def client(fake_settings):
    app.dependency_overrides[get_settings] = lambda: fake_settings
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def mock_llm_complete():
    with patch("backend.services.llm.AsyncOpenAI") as mock:
        instance = mock.return_value
        instance.chat.completions.create = AsyncMock(
            return_value=type(
                "R",
                (),
                {
                    "choices": [
                        type(
                            "C",
                            (),
                            {
                                "message": type("M", (), {"content": "OK"})(),
                                "finish_reason": "stop",
                            },
                        )()
                    ],
                    "usage": type(
                        "U", (), {"prompt_tokens": 5, "completion_tokens": 1}
                    )(),
                },
            )()
        )
        yield mock
