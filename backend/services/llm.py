"""
Provider-aware LLM service.

Selects the appropriate SDK client based on ``LLMConfig.base_url``:

* ``https://api.anthropic.com`` — uses ``AsyncAnthropic`` (Messages API)
* anything else            — uses ``AsyncOpenAI`` (OpenAI-compatible chat completions)

Swap ``base_url`` in .env or via BYOK headers to target OpenAI, Anthropic,
Mistral, Ollama, vLLM, etc. without changing call sites.
"""

from dataclasses import dataclass
from typing import Optional

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI


_ANTHROPIC_BASE = "https://api.anthropic.com"


@dataclass
class LLMConfig:
    api_key: str
    base_url: str
    model: str


def _is_anthropic(base_url: str) -> bool:
    return base_url.rstrip("/").startswith(_ANTHROPIC_BASE)


class LLMService:
    """Thin async wrapper that dispatches to the right provider SDK.

    Initialised once per request via ``get_llm_service`` and injected by
    FastAPI's dependency system.
    """

    def __init__(self, config: LLMConfig) -> None:
        self.model = config.model
        self._anthropic: Optional[AsyncAnthropic] = None
        self._openai: Optional[AsyncOpenAI] = None
        if _is_anthropic(config.base_url):
            self._anthropic = AsyncAnthropic(api_key=config.api_key)
        else:
            self._openai = AsyncOpenAI(
                api_key=config.api_key,
                base_url=config.base_url,
            )

    async def complete(
        self,
        messages: list[dict],
        temperature: float = 0.3,
        json_mode: bool = False,
    ) -> str:
        """Send chat messages and return the assistant reply as a string.

        ``json_mode=True`` requests a JSON object response.  On OpenAI-compatible
        providers this uses ``response_format``; on Anthropic a system instruction
        is appended instead (the native API doesn't expose a JSON mode flag).
        """
        if self._anthropic is not None:
            return await self._complete_anthropic(self._anthropic, messages, temperature, json_mode)
        assert self._openai is not None
        return await self._complete_openai(self._openai, messages, temperature, json_mode)

    # ------------------------------------------------------------------
    # Provider implementations
    # ------------------------------------------------------------------

    async def _complete_anthropic(
        self,
        client: AsyncAnthropic,
        messages: list[dict],
        temperature: float,
        json_mode: bool,
    ) -> str:
        # Anthropic separates system messages from the conversation turns.
        system_parts: list[str] = []
        turns: list[dict] = []
        for m in messages:
            if m["role"] == "system":
                system_parts.append(m["content"])
            else:
                turns.append(m)

        if json_mode:
            system_parts.append("Respond with valid JSON only.")

        kwargs: dict = {"temperature": temperature}
        if system_parts:
            kwargs["system"] = "\n\n".join(system_parts)

        response = await client.messages.create(
            model=self.model,
            max_tokens=4096,
            messages=turns,  # type: ignore[arg-type]
            **kwargs,
        )
        return response.content[0].text

    async def _complete_openai(
        self,
        client: AsyncOpenAI,
        messages: list[dict],
        temperature: float,
        json_mode: bool,
    ) -> str:
        kwargs: dict = {}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = await client.chat.completions.create(
            model=self.model,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            **kwargs,
        )
        return response.choices[0].message.content
