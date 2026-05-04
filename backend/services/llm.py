"""
Provider-aware LLM service.

Selects the appropriate SDK client based on ``LLMConfig.base_url``:

* ``https://api.anthropic.com`` — uses ``AsyncAnthropic`` (Messages API)
* anything else            — uses ``AsyncOpenAI`` (OpenAI-compatible chat completions)

Swap ``base_url`` in .env or via BYOK headers to target OpenAI, Anthropic,
Mistral, Ollama, vLLM, etc. without changing call sites.
"""

import re
from dataclasses import dataclass
from typing import Optional

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI


_ANTHROPIC_BASE = "https://api.anthropic.com"


def _extract_json(text: str) -> str:
    """Best-effort extraction of a JSON object from a model response.

    Handles three failure modes common in small/reasoning models:
    - <think>…</think> blocks prepended by reasoning models
    - Markdown code fences (```json … ```)
    - Stray text before or after the JSON object
    """
    # Strip reasoning blocks
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    # Strip markdown fences
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n?```\s*$", "", text, flags=re.MULTILINE).strip()
    # Extract outermost { … } by bracket counting
    start = text.find("{")
    if start == -1:
        return text
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return text[start:]


@dataclass
class LLMConfig:
    api_key: str
    base_url: str
    model: str


@dataclass
class CompletionResult:
    text: str
    input_tokens: int
    output_tokens: int


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
        """Send chat messages and return the text reply.

        ``json_mode=True`` requests a JSON object response.  On OpenAI-compatible
        providers this uses ``response_format``; on Anthropic a system instruction
        is appended instead (the native API doesn't expose a JSON mode flag).
        """
        result = await self.complete_with_usage(messages, temperature, json_mode)
        return result.text

    async def complete_with_usage(
        self,
        messages: list[dict],
        temperature: float = 0.3,
        json_mode: bool = False,
    ) -> CompletionResult:
        """Send chat messages and return the reply with token usage."""
        if self._anthropic is not None:
            text, inp, out = await self._complete_anthropic(self._anthropic, messages, temperature, json_mode)
        else:
            assert self._openai is not None
            text, inp, out = await self._complete_openai(self._openai, messages, temperature, json_mode)
        return CompletionResult(
            text=_extract_json(text) if json_mode else text,
            input_tokens=inp,
            output_tokens=out,
        )

    # ------------------------------------------------------------------
    # Provider implementations
    # ------------------------------------------------------------------

    async def _complete_anthropic(
        self,
        client: AsyncAnthropic,
        messages: list[dict],
        temperature: float,
        json_mode: bool,
    ) -> tuple[str, int, int]:
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
        return (
            response.content[0].text,
            response.usage.input_tokens,
            response.usage.output_tokens,
        )

    async def _complete_openai(
        self,
        client: AsyncOpenAI,
        messages: list[dict],
        temperature: float,
        json_mode: bool,
    ) -> tuple[str, int, int]:
        kwargs: dict = {}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = await client.chat.completions.create(
            model=self.model,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            **kwargs,
        )
        usage = response.usage
        return (
            response.choices[0].message.content,
            usage.prompt_tokens if usage else 0,
            usage.completion_tokens if usage else 0,
        )
