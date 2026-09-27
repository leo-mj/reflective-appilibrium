"""
LLM router — /api/llm

Exposes the LLM service over HTTP so the frontend never handles API keys.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..config import Settings, get_settings
from ..dependencies import get_llm_service
from ..services.llm import LLMService
from .shared import scrub_provider_error

router = APIRouter(prefix="/api/llm", tags=["llm"])
logger = logging.getLogger(__name__)

# ── Request / response models ──────────────────────────────────────────────────


class Message(BaseModel):
    """A single chat message with a role and text content."""

    role: str = Field(pattern=r"^(system|user|assistant)$")
    content: str = Field(max_length=100_000)


class CompletionRequest(BaseModel):
    """Payload for ``POST /api/llm/complete``."""

    messages: list[Message] = Field(min_length=1, max_length=100)
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    json_mode: bool = False


class TokenUsage(BaseModel):
    """Token consumption reported by the LLM provider for a single completion."""

    input_tokens: int
    output_tokens: int


class CompletionResponse(BaseModel):
    """Response from ``POST /api/llm/complete``."""

    text: str
    model: str
    usage: TokenUsage


class ModelsResponse(BaseModel):
    """Response from ``GET /api/llm/models``."""

    models: list[str]


def _provider_refusal(exc: Exception, what: str) -> HTTPException:
    """A provider's error, scrubbed, as the 400 the settings modal shows.

    For the two endpoints whose job is to say why a key or model does not work.
    Safe to log once scrubbed: neither sends anything of anyone's reasoning, so
    the provider's reply can quote only the key it just rejected.
    """
    message = scrub_provider_error(getattr(exc, "message", None) or str(exc))
    logger.info(f"{what} failed: {message}")
    return HTTPException(status_code=400, detail=message)


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.get("/configured-providers")
async def configured_providers(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    """Return base URLs that have server-side keys configured (keys never exposed)."""
    return {"base_urls": list(settings.llm_api_keys.keys())}


@router.post("/test")
async def test_connection(
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> dict:
    """Verify that the supplied API key and model are reachable.

    Provider errors (bad key, unknown model, unsupported parameter) are surfaced
    verbatim as a 400 so the settings modal can show the real reason instead of a
    generic 500.
    """
    try:
        await llm.complete(
            messages=[{"role": "user", "content": "Reply with the single word OK."}],
            temperature=0.0,
            json_mode=False,
        )
    except Exception as exc:  # noqa: BLE001 — this endpoint's job is to report why
        raise _provider_refusal(exc, f"Connection test for model '{llm.model}'")
    return {"status": "ok", "model": llm.model}


@router.get("/models", response_model=ModelsResponse)
async def list_models(
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> ModelsResponse:
    """The models the supplied key can use, newest first.

    What the settings modal suggests for the Model field, asked of the provider
    so the app keeps no list of its own to go stale. Through
    ``get_llm_service`` like every endpoint that uses a key, so the provider
    allowlist, the rule on server-side keys and the rate limit all apply.
    """
    try:
        models = await llm.list_models()
    except Exception as exc:  # noqa: BLE001 — as the connection test
        raise _provider_refusal(exc, "Listing models")
    return ModelsResponse(models=models)


@router.post("/complete", response_model=CompletionResponse)
async def complete(
    request: CompletionRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> CompletionResponse:
    """Send a prompt to the configured LLM and return the reply."""
    logger.info("Sending request to LLM.")
    result = await llm.complete_with_usage(
        messages=[m.model_dump() for m in request.messages],
        temperature=request.temperature,
        json_mode=request.json_mode,
    )
    logger.info(f"Received a {len(result.text)}-character response.")
    return CompletionResponse(
        text=result.text,
        model=llm.model,
        usage=TokenUsage(
            input_tokens=result.input_tokens, output_tokens=result.output_tokens
        ),
    )
