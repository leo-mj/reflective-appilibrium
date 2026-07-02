"""
LLM router — /api/llm

Exposes the LLM service over HTTP so the frontend never handles API keys.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..config import Settings, get_settings
from ..dependencies import get_llm_service
from ..services.llm import LLMService

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
    """Verify that the supplied API key and model are reachable."""
    await llm.complete(
        messages=[{"role": "user", "content": "Reply with the single word OK."}],
        temperature=0.0,
        json_mode=False,
    )
    return {"status": "ok", "model": llm.model}


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
    logger.info(f"Received response beginning with: {result.text[:20]}")
    return CompletionResponse(
        text=result.text,
        model=llm.model,
        usage=TokenUsage(
            input_tokens=result.input_tokens, output_tokens=result.output_tokens
        ),
    )
