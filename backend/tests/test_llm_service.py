from backend.services.llm import LLMConfig, LLMService


def test_init_uses_provided_config():
    config = LLMConfig(api_key="k", base_url="https://example.com/v1", model="m")
    svc = LLMService(config)
    assert svc.model == "m"


def test_init_empty_key_does_not_raise():
    config = LLMConfig(api_key="", base_url="https://api.openai.com/v1", model="gpt-4o-mini")
    svc = LLMService(config)
    assert svc.model == "gpt-4o-mini"
