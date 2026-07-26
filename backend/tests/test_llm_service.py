import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI, BadRequestError

from backend.services.llm import (
    LLMConfig,
    LLMService,
    _is_anthropic,
    _is_unsupported_temperature,
)


def test_init_uses_provided_config():
    config = LLMConfig(api_key="k", base_url="https://example.com/v1", model="m")
    svc = LLMService(config)
    assert svc.model == "m"


def test_init_empty_key_does_not_raise():
    config = LLMConfig(
        api_key="", base_url="https://api.openai.com/v1", model="gpt-4o-mini"
    )
    svc = LLMService(config)
    assert svc.model == "gpt-4o-mini"


# --- _is_anthropic ---


def test_is_anthropic_exact():
    assert _is_anthropic("https://api.anthropic.com/v1") is True


def test_is_anthropic_trailing_slash():
    assert _is_anthropic("https://api.anthropic.com/v1/") is True


def test_is_anthropic_openai():
    assert _is_anthropic("https://api.openai.com/v1") is False


def test_is_anthropic_mistral():
    assert _is_anthropic("https://api.mistral.ai/v1") is False


def test_is_anthropic_local():
    assert _is_anthropic("http://localhost:11434/v1") is False


# --- provider client selection ---


def test_anthropic_url_creates_anthropic_client():
    config = LLMConfig(
        api_key="k", base_url="https://api.anthropic.com/v1", model="claude-haiku-4-5"
    )
    svc = LLMService(config)
    assert isinstance(svc._anthropic, AsyncAnthropic)
    assert svc._openai is None


def test_openai_url_creates_openai_client():
    config = LLMConfig(
        api_key="k", base_url="https://api.openai.com/v1", model="gpt-4o"
    )
    svc = LLMService(config)
    assert isinstance(svc._openai, AsyncOpenAI)
    assert svc._anthropic is None


def test_mistral_url_creates_openai_client():
    config = LLMConfig(
        api_key="k", base_url="https://api.mistral.ai/v1", model="mistral-small-latest"
    )
    svc = LLMService(config)
    assert isinstance(svc._openai, AsyncOpenAI)
    assert svc._anthropic is None


def test_local_url_creates_openai_client():
    config = LLMConfig(api_key="", base_url="http://localhost:11434/v1", model="qwen3")
    svc = LLMService(config)
    assert isinstance(svc._openai, AsyncOpenAI)
    assert svc._anthropic is None


# --- temperature-restriction handling (reasoning models) ---


def _bad_request(message: str) -> BadRequestError:
    resp = httpx.Response(
        400, request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    )
    return BadRequestError(message, response=resp, body=None)


def _fake_openai_response(text: str):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=text))],
        usage=SimpleNamespace(prompt_tokens=5, completion_tokens=7),
    )


def test_is_unsupported_temperature_matches_temperature_error():
    exc = _bad_request(
        "Unsupported value: 'temperature' does not support 0.0 with this model. "
        "Only the default (1) value is supported."
    )
    assert _is_unsupported_temperature(exc) is True


def test_is_unsupported_temperature_ignores_other_errors():
    assert (
        _is_unsupported_temperature(_bad_request("model `x` does not exist")) is False
    )


def test_openai_retries_without_temperature_when_unsupported():
    config = LLMConfig(
        api_key="k", base_url="https://api.openai.com/v1", model="gpt-5.6-terra"
    )
    svc = LLMService(config)
    create = AsyncMock(
        side_effect=[
            _bad_request("'temperature' does not support 0.0 with this model."),
            _fake_openai_response("OK"),
        ]
    )
    svc._openai = MagicMock()
    svc._openai.chat.completions.create = create

    result = asyncio.run(
        svc.complete_with_usage([{"role": "user", "content": "hi"}], temperature=0.0)
    )
    assert result.text == "OK"
    # First attempt sent temperature; the retry dropped it.
    assert create.call_count == 2
    assert "temperature" in create.call_args_list[0].kwargs
    assert "temperature" not in create.call_args_list[1].kwargs


def test_openai_does_not_retry_unrelated_bad_request():
    config = LLMConfig(
        api_key="k", base_url="https://api.openai.com/v1", model="gpt-5.6-terra"
    )
    svc = LLMService(config)
    create = AsyncMock(
        side_effect=_bad_request("The model `gpt-5.6-terra` does not exist")
    )
    svc._openai = MagicMock()
    svc._openai.chat.completions.create = create

    # A genuinely bad model name is surfaced, not silently retried.
    with pytest.raises(BadRequestError):
        asyncio.run(
            svc.complete_with_usage(
                [{"role": "user", "content": "hi"}], temperature=0.0
            )
        )
    assert create.call_count == 1
