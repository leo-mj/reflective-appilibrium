"""
Judgments router — /api/judgments

Asks the configured LLM to present questions and thought experiments that
may elicit new moral judgments the user has not yet articulated.
"""

import logging
import json

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..dependencies import get_llm_service
from ..models.re_state import DEFAULT_CONFIDENCE, REElement, RELogEntry
from ..services.llm import LLMService
from ..services.prompts import build_judgments_prompt

router = APIRouter(prefix="/api/judgments", tags=["judgments"])
logger = logging.getLogger(__name__)


# ── Request / response models ──────────────────────────────────────────────────


class ElicitJudgmentsRequest(BaseModel):
    """Payload for ``POST /api/judgments/elicit``.

    ``elements`` is the full element list so the LLM can avoid re-eliciting
    judgments that are already recorded or withdrawn.  ``log`` provides recent
    round notes for additional context.
    """

    topic: str = Field(max_length=500)
    elements: list[REElement] = Field(default_factory=list, max_length=200)
    log: list[RELogEntry] = Field(default_factory=list, max_length=1_000)


Confidence = Annotated[float, Field(ge=0.0, le=1.0)]


class JudgmentOption(BaseModel):
    """One of several jointly exhaustive positions a user might hold in response to a question.

    ``confidence`` is always ``DEFAULT_CONFIDENCE``: the field exists because the
    frontend requires one on every judgment, but its value is the user's to set,
    not the model's.  The elicitation prompt asks for no score, and the endpoint
    overrides any the model volunteers anyway.
    """

    text: str = Field(max_length=2_000)
    confidence: Confidence = DEFAULT_CONFIDENCE


class JudgmentSuggestion(BaseModel):
    """A thought experiment paired with multiple possible positions.

    ``judgments`` contains 2–4 options that collectively cover the main stances
    a user might take in response to ``question``.  The user accepts the ones
    they agree with and rejects the rest.
    """

    question: str = Field(max_length=2_000)
    judgments: list[JudgmentOption] = Field(min_length=1, max_length=6)


class ElicitJudgmentsResponse(BaseModel):
    """Response from ``POST /api/judgments/elicit``."""

    suggestions: list[JudgmentSuggestion]
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/elicit", response_model=ElicitJudgmentsResponse)
async def elicit_judgments(
    request: ElicitJudgmentsRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> ElicitJudgmentsResponse:
    """Ask the LLM for questions and thought experiments to elicit new judgments."""
    logger.info(
        f"Requesting judgment elicitation from model '{llm.model}' for topic '{request.topic}' "
        f"with {len(request.elements)} elements."
    )
    prompt = build_judgments_prompt(request.topic, request.elements, request.log)
    result = await llm.complete_with_usage(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.6,
        json_mode=True,
    )
    data = json.loads(result.text)
    # Overwrite rather than trust: a model that scores its options despite the
    # prompt must not have those scores reach the user as if they were theirs.
    suggestions = [
        JudgmentSuggestion.model_validate(
            {
                **s,
                "judgments": [
                    {**j, "confidence": DEFAULT_CONFIDENCE}
                    for j in s.get("judgments", [])
                ],
            }
        )
        for s in data.get("suggestions", [])
    ]
    total_judgments = sum(len(s.judgments) for s in suggestions)
    logger.info(
        f"Received {len(suggestions)} judgment elicitation suggestions "
        f"({total_judgments} judgment options) from LLM."
    )

    return ElicitJudgmentsResponse(
        suggestions=suggestions,
        model=llm.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )
