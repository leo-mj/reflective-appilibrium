"""
Principles router — /api/principles

Asks the configured LLM to suggest new principles that would systematise
existing judgments in the RE state.
"""
import logging
import json

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..dependencies import get_llm_service
from ..models.re_state import REElement
from ..services.llm import LLMService

router = APIRouter(prefix="/api/principles", tags=["principles"])
logger = logging.getLogger(__name__)


# ── Request / response models ──────────────────────────────────────────────────

class SuggestPrinciplesRequest(BaseModel):
    """Payload for ``POST /api/principles/suggest``."""

    topic: str = Field(max_length=500)
    elements: list[REElement] = Field(min_length=1, max_length=200)


Confidence = Literal["high", "moderate", "low"]


class PrincipleSuggestion(BaseModel):
    """A single LLM-proposed principle.

    ``covers`` lists the IDs of the judgments (and/or existing principles)
    that this principle would systematise.
    """

    text: str = Field(max_length=2_000)
    confidence: Confidence
    covers: list[str] = Field(default_factory=list)
    explanation: str = Field(max_length=2_000)


class SuggestPrinciplesResponse(BaseModel):
    """Response from ``POST /api/principles/suggest``."""

    suggestions: list[PrincipleSuggestion]
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


# ── Prompt ────────────────────────────────────────────────────────────────────

def _build_prompt(
    topic: str,
    judgments: list[REElement],
    existing_principles: list[REElement],
) -> str:
    """Build the LLM prompt for principle suggestion.

    Both active judgments and existing principles are included so the model
    can avoid redundant proposals and estimate how many new principles are
    warranted (target: roughly one per three elements).
    """
    judgment_lines = "\n".join(f"  {e.id}: {e.text}" for e in judgments)
    principle_lines = (
        "\n".join(f"  {e.id}: {e.text}" for e in existing_principles)
        if existing_principles
        else "  (none)"
    )

    return f"""\
You are assisting a reflective equilibrium (RE) analysis in ethics.
Topic: "{topic}"

Existing judgments and principles to systematise:
{judgment_lines}
{principle_lines}

Task: propose at least 2 and up to {(len(judgments) + len(existing_principles))/3} \
NEW principles that would systematise as many of the judgments 
and/or principles above as possible. Each principle should:
- Be a general moral rule or norm (not a particular verdict).
- Cover several judgments (list their IDs in "covers").
- Not duplicate any already-recorded principle.

Respond with valid JSON only, in exactly this format:
{{
  "suggestions": [
    {{
      "text": "One-sentence statement of the principle.",
      "confidence": "high" | "moderate" | "low",
      "covers": ["J1", "J3"],
      "explanation": "One sentence explaining how this principle systematises the listed judgments."
    }}
  ]
}}

If the existing principles already cover all judgments well, return {{"suggestions": []}}."""


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
    prompt = _build_prompt(request.topic, judgments, existing_principles)
    result = await llm.complete_with_usage(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        json_mode=True,
    )
    data = json.loads(result.text)
    suggestions = [PrincipleSuggestion(**s) for s in data.get("suggestions", [])]
    logger.info(f"Received {len(suggestions)} principle suggestions from LLM.")

    return SuggestPrinciplesResponse(
        suggestions=suggestions,
        model=llm.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )
