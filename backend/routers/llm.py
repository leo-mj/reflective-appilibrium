"""
LLM router — /api/llm

Exposes the LLM service over HTTP so the frontend never handles API keys.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..dependencies import get_llm_service
from ..services.llm import LLMService

router = APIRouter(prefix="/api/llm", tags=["llm"])
logger = logging.getLogger(__name__)

# ── Request / response models ──────────────────────────────────────────────────

class Message(BaseModel):
    role: str = Field(pattern=r"^(system|user|assistant)$")
    content: str = Field(max_length=100_000)


class CompletionRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=100)
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    json_mode: bool = False


class CompletionResponse(BaseModel):
    text: str
    model: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/complete", response_model=CompletionResponse)
async def complete(
    request: CompletionRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> CompletionResponse:
    """Send a prompt to the configured LLM and return the reply."""
    logger.info("Sending request to LLM.")
    text = await llm.complete(
        messages=[m.model_dump() for m in request.messages],
        temperature=request.temperature,
        json_mode=request.json_mode,
    )
    logger.info(f"Received response beginning with: {text[:20]}")
    return CompletionResponse(text=text, model=llm.model)
