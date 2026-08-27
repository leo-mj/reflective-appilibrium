"""
Review router — /api/review

Asks the configured LLM to read a whole RE process and report what it amounts to:
where the position moved, where it turned unexpectedly, and what coherence was
available and not taken.  Deliberately macro-level — the app already replays the
process round by round, so a recap would add nothing.
"""

import logging

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..dependencies import get_llm_service
from ..models.re_state import REState
from ..services.llm import LLMService
from ..services.prompts import build_review_prompt
from ..services.response_schemas import REVIEW_SCHEMA
from .shared import LLMTaskResponse, parse_json_object

router = APIRouter(prefix="/api/review", tags=["review"])
logger = logging.getLogger(__name__)


# ── Request / response models ──────────────────────────────────────────────────


class ReviewRequest(BaseModel):
    """Payload for ``POST /api/review/analyze``.

    The whole state, because a review reads the *shape* of the process: the
    history trails on elements and relations, the round each thing arrived in,
    and who introduced it.  Any previously accepted reviews ride along inside
    ``state.reviews``, which is what lets this one carry their thread forward —
    so there is no separate field for them.
    """

    state: REState


class ReviewResponse(LLMTaskResponse):
    """Response from ``POST /api/review/analyze``.

    The five parts are returned separately rather than as one block of prose so
    the UI can render and edit them individually, and so a later review can be
    given an earlier one section by section.
    """

    headline: str
    arc: str
    surprises: str
    missed: str
    method: str


# ── Endpoint ──────────────────────────────────────────────────────────────────

_PARTS = ("headline", "arc", "surprises", "missed", "method")


@router.post("/analyze", response_model=ReviewResponse)
async def analyze_process(
    request: ReviewRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> ReviewResponse:
    """Ask the LLM for a macro-level review of the process so far."""
    state = request.state
    logger.info(
        f"Requesting process review from model '{llm.model}' for topic "
        f"'{state.topic}' at round {state.round} "
        f"({len(state.elements)} elements, {len(state.reviews)} earlier reviews)."
    )
    prompt = build_review_prompt(state)
    result = await llm.complete_with_usage(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        json_mode=True,
        json_schema=REVIEW_SCHEMA,
    )
    data = parse_json_object(result.text, llm.model)
    parts = {key: str(data.get(key, "")) for key in _PARTS}

    # Reported, never enforced. The 500-word cap is a target the prompt states and
    # the UI displays; truncating here would cut prose mid-sentence, and rejecting
    # would turn a review that runs slightly long into an error the user has no way
    # to act on. If this warns routinely, tighten the budgets in the prompt.
    words = sum(len(part.split()) for part in parts.values())
    if words > 500:
        logger.warning(
            f"Model '{llm.model}' returned a {words}-word review, over the 500-word target."
        )
    logger.info(f"Received a {words}-word process review from LLM.")

    return ReviewResponse(
        **parts,
        model=llm.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )
