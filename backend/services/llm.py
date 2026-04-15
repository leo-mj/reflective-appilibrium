"""
OpenAI-compatible LLM service.

Uses the chat completions API, which is supported by OpenAI, Ollama, vLLM,
and most other local inference servers. Swap `base_url` in .env to point at
any compatible endpoint without changing this file.
"""

from dataclasses import dataclass

from openai import AsyncOpenAI


@dataclass
class LLMConfig:
    api_key: str
    base_url: str
    model: str


class LLMService:
    """Thin async wrapper around the OpenAI chat-completions API.

    Initialised once per request via ``get_llm_service`` and injected by
    FastAPI's dependency system.  Swap ``Settings.openai_base_url`` to point
    at Ollama, vLLM, or any other compatible server without touching this class.
    """

    def __init__(self, config: LLMConfig) -> None:
        """Initialise the underlying ``AsyncOpenAI`` client from *config*."""
        self._client = AsyncOpenAI(
            api_key=config.api_key,
            base_url=config.base_url,
        )
        self.model = config.model

    async def complete(
        self,
        messages: list[dict],
        temperature: float = 0.3,
        json_mode: bool = False,
    ) -> str:
        """
        Send a list of chat messages and return the assistant reply as a string.

        `json_mode=True` requests a JSON object response via `response_format`.
        Not all local models support this; disable if the provider rejects it.
        """
        kwargs = {}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = await self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            **kwargs,
        )
        return response.choices[0].message.content
