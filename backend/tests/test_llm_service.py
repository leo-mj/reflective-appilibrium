from backend.services.llm import LLMConfig, LLMService, _is_anthropic
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI


def test_init_uses_provided_config():
    config = LLMConfig(api_key="k", base_url="https://example.com/v1", model="m")
    svc = LLMService(config)
    assert svc.model == "m"


def test_init_empty_key_does_not_raise():
    config = LLMConfig(api_key="", base_url="https://api.openai.com/v1", model="gpt-4o-mini")
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
    config = LLMConfig(api_key="k", base_url="https://api.anthropic.com/v1", model="claude-haiku-4-5")
    svc = LLMService(config)
    assert isinstance(svc._anthropic, AsyncAnthropic)
    assert svc._openai is None

def test_openai_url_creates_openai_client():
    config = LLMConfig(api_key="k", base_url="https://api.openai.com/v1", model="gpt-4o")
    svc = LLMService(config)
    assert isinstance(svc._openai, AsyncOpenAI)
    assert svc._anthropic is None

def test_mistral_url_creates_openai_client():
    config = LLMConfig(api_key="k", base_url="https://api.mistral.ai/v1", model="mistral-small-latest")
    svc = LLMService(config)
    assert isinstance(svc._openai, AsyncOpenAI)
    assert svc._anthropic is None

def test_local_url_creates_openai_client():
    config = LLMConfig(api_key="", base_url="http://localhost:11434/v1", model="qwen3")
    svc = LLMService(config)
    assert isinstance(svc._openai, AsyncOpenAI)
    assert svc._anthropic is None
