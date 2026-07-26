"""
Relations router — /api/relations

Asks the configured LLM to identify relations between existing RE elements.
"""

import logging
import json

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..dependencies import get_llm_service
from ..models.re_state import REElement, RERelation, RelationType
from ..services.llm import LLMService
from ..services.prompts import build_relations_prompt
from ..services.response_schemas import RELATIONS_SCHEMA

router = APIRouter(prefix="/api/relations", tags=["relations"])
logger = logging.getLogger(__name__)


# ── Request / response models ──────────────────────────────────────────────────


class SuggestRequest(BaseModel):
    """Payload for ``POST /api/relations/suggest``.

    ``existing_relations`` are passed so the LLM can skip already-recorded
    directed pairs and only return genuinely new suggestions.
    """

    topic: str = Field(max_length=500)
    elements: list[REElement] = Field(min_length=2, max_length=200)
    existing_relations: list[RERelation] = Field(default_factory=list, max_length=5_000)


class RelationSuggestion(BaseModel):
    """A single LLM-proposed directed relation between two RE elements."""

    from_id: str = Field(alias="from")
    to_id: str = Field(alias="to")
    type: RelationType
    explanation: str

    model_config = {"populate_by_name": True}


class SuggestResponse(BaseModel):
    """Response from ``POST /api/relations/suggest``."""

    suggestions: list[RelationSuggestion]
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/suggest", response_model=SuggestResponse)
async def suggest_relations(
    request: SuggestRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> SuggestResponse:
    """Ask the LLM to identify relations between the provided RE elements."""
    active = [e for e in request.elements if e.status not in {"withdrawn", "rejected"}]
    prompt = build_relations_prompt(request.topic, active, request.existing_relations)
    logger.info(
        f"Requesting relation suggestions from model '{llm.model}' between {len(active)} active elements."
    )
    result = await llm.complete_with_usage(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        json_mode=True,
        json_schema=RELATIONS_SCHEMA,
    )
    try:
        data = json.loads(result.text)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse LLM response as JSON: {result.text!r}")
        raise
    suggestions = [RelationSuggestion(**r) for r in data.get("relations", [])]
    logger.info(f"Received LLM suggestions for {len(suggestions)} new relations.")

    return SuggestResponse(
        suggestions=suggestions,
        model=llm.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )
