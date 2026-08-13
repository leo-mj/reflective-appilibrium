"""
Matrix router — /api/matrix

Asks the configured LLM to produce a symmetric relatedness matrix for the
judgments and principles in the RE state.
"""

import logging

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..dependencies import get_llm_service
from ..models.re_state import REElement
from ..services.llm import LLMService
from ..services.prompts import build_matrix_prompt
from .shared import LLMTaskResponse, parse_json_object

router = APIRouter(prefix="/api/matrix", tags=["matrix"])
logger = logging.getLogger(__name__)


# ── Request / response models ──────────────────────────────────────────────────


class MatrixRequest(BaseModel):
    """Payload for ``POST /api/matrix/analyze``."""

    topic: str = Field(max_length=500)
    elements: list[REElement] = Field(min_length=2, max_length=200)


class MatrixResponse(LLMTaskResponse):
    """Response from ``POST /api/matrix/analyze``.

    ``matrix`` is a square dict-of-dicts keyed by element ID with float
    relatedness scores in [0, 1]; diagonal entries are always 1.0.
    ``pair_descriptions`` maps ``"A→B"`` (IDs in JS sort order) to a
    one-sentence description of the relationship.
    """

    overview: str
    matrix: dict[str, dict[str, float]]
    pair_descriptions: dict[str, str] = Field(alias="pairDescriptions")

    model_config = {"populate_by_name": True}


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/analyze", response_model=MatrixResponse)
async def analyze(
    request: MatrixRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> MatrixResponse:
    """Compute a relatedness matrix for the provided RE elements.

    Raises 422 when fewer than two elements survive filtering.  ``MatrixRequest``
    enforces a minimum of 2 on the *submitted* list, but withdrawn elements and
    background theories are dropped below, so a valid request can still leave
    too few elements to relate.
    """
    active = [
        e
        for e in request.elements
        if e.status != "withdrawn" and e.type in ("judgment", "principle")
    ]
    if len(active) < 2:
        raise HTTPException(
            status_code=422,
            detail=(
                "A relatedness matrix needs at least 2 active judgments or "
                f"principles, got {len(active)}."
            ),
        )
    logger.info(
        f"Requesting relatedness matrix from model '{llm.model}' for {len(active)} elements."
    )
    prompt = build_matrix_prompt(request.topic, active)
    result = await llm.complete_with_usage(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        json_mode=True,
    )
    data = parse_json_object(result.text, llm.model)
    logger.info("Received relatedness matrix from LLM.")
    return MatrixResponse(
        overview=data.get("overview", ""),
        matrix=data.get("matrix", {}),
        pairDescriptions=data.get("pairDescriptions", {}),
        model=llm.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )
