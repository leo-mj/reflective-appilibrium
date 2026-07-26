"""
Provider-aware LLM service.

Selects the appropriate SDK client based on ``LLMConfig.base_url``:

* ``https://api.anthropic.com`` — uses ``AsyncAnthropic`` (Messages API)
* anything else            — uses ``AsyncOpenAI`` (OpenAI-compatible chat completions)

Swap ``base_url`` in .env or via BYOK headers to target OpenAI, Anthropic,
Mistral, Ollama, vLLM, etc. without changing call sites.
"""

import json
import logging
import re
from dataclasses import dataclass
from typing import Optional

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI, BadRequestError


logger = logging.getLogger(__name__)

_ANTHROPIC_BASE = "https://api.anthropic.com"


def _is_unsupported_schema(exc: BadRequestError) -> bool:
    """True when a provider 400 is about ``response_format`` / structured output.

    Many OpenAI-compatible endpoints (older vLLM and Ollama builds, some proxies)
    accept ``{"type": "json_object"}`` but reject ``{"type": "json_schema"}``,
    or reject ``response_format`` outright.  Matching the parameter name lets us
    degrade to plain JSON mode instead of failing the request, while unrelated
    400s (bad model name, malformed payload) still propagate.
    """
    if getattr(exc, "param", None) == "response_format":
        return True
    message = str(exc).lower()
    return "response_format" in message or "json_schema" in message


def _is_unsupported_temperature(exc: BadRequestError) -> bool:
    """True when a provider 400 is specifically about an unsupported temperature.

    OpenAI reasoning models (the o-series and the GPT-5 family) reject any
    non-default temperature with a 400 whose ``param``/message names
    ``temperature`` — e.g. "Unsupported value: 'temperature' does not support
    0.0 with this model. Only the default (1) value is supported."  We match on
    that so the retry never swallows unrelated bad requests (a bad model name,
    a malformed payload).
    """
    if getattr(exc, "param", None) == "temperature":
        return True
    return "temperature" in str(exc).lower()


def _anthropic_text(response) -> str:
    """Reduce an Anthropic response's content blocks to a single string.

    A forced tool call returns the payload as a ``tool_use`` block whose
    ``input`` is already a parsed object, so it is re-serialised to keep this
    method's "return text" contract; plain replies return concatenated text
    blocks.  Indexing ``content[0].text`` directly would raise on any response
    whose first block is not text — which is exactly the tool-use case.
    """
    for block in response.content:
        if getattr(block, "type", None) == "tool_use":
            return json.dumps(block.input)
    parts = [b.text for b in response.content if getattr(b, "type", None) == "text"]
    return "".join(parts)


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


@dataclass(frozen=True)
class ResponseSchema:
    """A JSON Schema the model's output must conform to.

    ``name`` identifies the schema to the provider — it becomes OpenAI's
    ``json_schema.name`` and the Anthropic tool name, so it must match
    ``^[a-zA-Z0-9_-]{1,64}$``.  ``description`` is used only on the Anthropic
    path, where the schema is expressed as a tool and the description tells the
    model what that tool is for.

    ``schema`` must satisfy OpenAI strict mode to be enforceable there: every
    object needs ``"additionalProperties": false``, and every property must be
    listed in ``required`` (express optionality as a ``["string", "null"]``
    type union rather than by omission).  See ``services.response_schemas``.
    """

    name: str
    description: str
    schema: dict


@dataclass
class LLMConfig:
    api_key: str
    base_url: str
    model: str
    max_tokens: int = 4096


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
        self.max_tokens = config.max_tokens
        self._anthropic: Optional[AsyncAnthropic] = None
        self._openai: Optional[AsyncOpenAI] = None
        if _is_anthropic(config.base_url):
            self._anthropic = AsyncAnthropic(api_key=config.api_key)
        else:
            self._openai = AsyncOpenAI(
                api_key=config.api_key or "placeholder",
                base_url=config.base_url,
            )

    async def complete(
        self,
        messages: list[dict],
        temperature: float = 0.3,
        json_mode: bool = False,
        json_schema: Optional[ResponseSchema] = None,
    ) -> str:
        """Send chat messages and return the text reply.

        ``json_mode=True`` requests a JSON object response.  On OpenAI-compatible
        providers this uses ``response_format``; on Anthropic a system instruction
        is appended instead (the native API doesn't expose a JSON mode flag).
        """
        result = await self.complete_with_usage(
            messages, temperature, json_mode, json_schema
        )
        return result.text

    async def complete_with_usage(
        self,
        messages: list[dict],
        temperature: float = 0.3,
        json_mode: bool = False,
        json_schema: Optional[ResponseSchema] = None,
    ) -> CompletionResult:
        """Send chat messages and return the reply with token usage.

        ``json_schema`` upgrades ``json_mode`` from "valid JSON" to "valid JSON
        of this shape", using whichever mechanism the provider offers: strict
        ``json_schema`` response format on OpenAI-compatible endpoints, forced
        tool use on Anthropic.  Providers that support neither fall back to
        plain ``json_mode`` — the prompt still describes the shape in prose, so
        the schema is a guarantee where available and a no-op where not.
        """
        if self._anthropic is not None:
            text, inp, out = await self._complete_anthropic(
                self._anthropic, messages, temperature, json_mode, json_schema
            )
        else:
            assert self._openai is not None
            text, inp, out = await self._complete_openai(
                self._openai, messages, temperature, json_mode, json_schema
            )
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
        json_schema: Optional[ResponseSchema] = None,
    ) -> tuple[str, int, int]:
        # Anthropic separates system messages from the conversation turns.
        system_parts: list[str] = []
        turns: list[dict] = []
        for m in messages:
            if m["role"] == "system":
                system_parts.append(m["content"])
            else:
                turns.append(m)

        kwargs: dict = {"temperature": temperature}

        if json_schema is not None:
            # The Messages API has no JSON-schema response format, but a forced
            # tool call is equivalent: the model must emit an input object
            # matching input_schema, which the API validates for us.
            kwargs["tools"] = [
                {
                    "name": json_schema.name,
                    "description": json_schema.description,
                    "input_schema": json_schema.schema,
                }
            ]
            kwargs["tool_choice"] = {"type": "tool", "name": json_schema.name}
        elif json_mode:
            system_parts.append("Respond with valid JSON only.")

        if system_parts:
            kwargs["system"] = "\n\n".join(system_parts)

        response = await client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=turns,  # type: ignore[arg-type]
            **kwargs,
        )
        if response.stop_reason == "max_tokens":
            logger.warning(
                "Model %s hit the %d-token output cap; the reply is truncated and "
                "will not parse as JSON. Raise LLM_MAX_TOKENS.",
                self.model,
                self.max_tokens,
            )
        return (
            _anthropic_text(response),
            response.usage.input_tokens,
            response.usage.output_tokens,
        )

    async def _complete_openai(
        self,
        client: AsyncOpenAI,
        messages: list[dict],
        temperature: float,
        json_mode: bool,
        json_schema: Optional[ResponseSchema] = None,
    ) -> tuple[str, int, int]:
        """Call an OpenAI-compatible endpoint, degrading on unsupported params.

        Two capabilities vary across the endpoints this backend targets, and
        each is dropped only once, in response to a 400 that names it:
        strict ``json_schema`` (unsupported by several local runtimes, falls
        back to plain JSON mode) and a non-default ``temperature`` (rejected by
        reasoning models, falls back to the provider default).  Any other 400
        propagates untouched.

        ``max_tokens`` is deliberately not sent: unlike Anthropic, these
        endpoints do not require it, newer models want ``max_completion_tokens``
        instead, and imposing our own ceiling would truncate replies that
        currently succeed.
        """
        use_schema = json_schema is not None
        use_temperature = True

        while True:
            kwargs: dict = {}
            if use_schema and json_schema is not None:
                kwargs["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {
                        "name": json_schema.name,
                        "schema": json_schema.schema,
                        "strict": True,
                    },
                }
            elif json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            if use_temperature:
                kwargs["temperature"] = temperature

            try:
                response = await client.chat.completions.create(
                    model=self.model,
                    messages=messages,  # type: ignore[arg-type]
                    **kwargs,
                )
                break
            except BadRequestError as exc:
                if use_temperature and _is_unsupported_temperature(exc):
                    logger.info(
                        "Model %s rejected temperature=%s; retrying with the provider default.",
                        self.model,
                        temperature,
                    )
                    use_temperature = False
                    continue
                if use_schema and _is_unsupported_schema(exc):
                    logger.info(
                        "Provider rejected strict json_schema for model %s; "
                        "retrying with plain JSON mode. The prompt still describes "
                        "the expected shape, but it is no longer enforced.",
                        self.model,
                    )
                    use_schema = False
                    continue
                raise

        choice = response.choices[0]
        # getattr, not attribute access: the field is guaranteed by the OpenAI
        # spec but not by every OpenAI-*compatible* runtime this backend targets.
        if getattr(choice, "finish_reason", None) == "length":
            logger.warning(
                "Model %s stopped at the output-length limit; the reply is "
                "truncated and will not parse as JSON.",
                self.model,
            )
        usage = response.usage
        return (
            choice.message.content or "",
            usage.prompt_tokens if usage else 0,
            usage.completion_tokens if usage else 0,
        )
