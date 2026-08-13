import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import get_settings, Settings


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
def _clear_settings_cache():
    """``get_settings`` is lru_cached, so one test's settings must not outlive it."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


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
