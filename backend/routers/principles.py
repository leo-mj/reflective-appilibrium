"""
Principles router — /api/principles

Asks the configured LLM to suggest new principles that would systematise
existing judgments in the RE state.
"""

import logging
import json

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..dependencies import get_llm_service
from ..models.re_state import DEFAULT_CONFIDENCE, REElement
from ..services.llm import LLMService
from ..services.prompts import build_principles_prompt
from ..services.response_schemas import PRINCIPLES_SCHEMA

router = APIRouter(prefix="/api/principles", tags=["principles"])
logger = logging.getLogger(__name__)


# ── Request / response models ──────────────────────────────────────────────────


class SuggestPrinciplesRequest(BaseModel):
    """Payload for ``POST /api/principles/suggest``."""

    topic: str = Field(max_length=500)
    elements: list[REElement] = Field(min_length=1, max_length=200)


Confidence = Annotated[float, Field(ge=0.0, le=1.0)]


class PrincipleSuggestion(BaseModel):
    """A single LLM-proposed principle.

    ``covers`` lists the IDs of the judgments (and/or existing principles)
    that this principle would systematise.  ``confidence`` is always
    ``DEFAULT_CONFIDENCE`` — see ``JudgmentOption`` in the judgments router for
    why the model does not get to set it.
    """

    text: str = Field(max_length=2_000)
    confidence: Confidence = DEFAULT_CONFIDENCE
    covers: list[str] = Field(default_factory=list)
    explanation: str = Field(max_length=2_000)


class SuggestPrinciplesResponse(BaseModel):
    """Response from ``POST /api/principles/suggest``."""

    suggestions: list[PrincipleSuggestion]
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/suggest", response_model=SuggestPrinciplesResponse)
async def suggest_principles(
    request: SuggestPrinciplesRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> SuggestPrinciplesResponse:
    """Ask the LLM to suggest new principles that systematise existing judgments and principles."""
    active = [e for e in request.elements if e.status not in {"withdrawn", "rejected"}]
    judgments = [e for e in active if e.type == "judgment"]
    existing_principles = [e for e in active if e.type == "principle"]

    logger.info(
        f"Requesting principle suggestions from model '{llm.model}' for {len(judgments)} judgments "
        f"and {len(existing_principles)} existing principles."
    )
    prompt = build_principles_prompt(request.topic, judgments, existing_principles)
    result = await llm.complete_with_usage(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        json_mode=True,
        json_schema=PRINCIPLES_SCHEMA,
    )
    data = json.loads(result.text)
    # Overwrite rather than trust — see the judgments router for the rationale.
    suggestions = [
        PrincipleSuggestion.model_validate({**s, "confidence": DEFAULT_CONFIDENCE})
        for s in data.get("suggestions", [])
    ]
    logger.info(f"Received {len(suggestions)} principle suggestions from LLM.")

    return SuggestPrinciplesResponse(
        suggestions=suggestions,
        model=llm.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )
