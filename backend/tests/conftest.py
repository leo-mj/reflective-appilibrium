import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import get_settings, Settings


@pytest.fixture
def fake_settings():
    return Settings(
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
            return_value=type("R", (), {
                "choices": [type("C", (), {
                    "message": type("M", (), {"content": "OK"})()
                })()],
                "usage": type("U", (), {"prompt_tokens": 5, "completion_tokens": 1})(),
            })()
        )
        yield mock
