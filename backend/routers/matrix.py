"""
Matrix router — /api/matrix

Asks the configured LLM to produce a symmetric relatedness matrix for the
judgments and principles in the RE state.
"""

import json
import logging

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..dependencies import get_llm_service
from ..models.re_state import REElement
from ..services.llm import LLMService

router = APIRouter(prefix="/api/matrix", tags=["matrix"])
logger = logging.getLogger(__name__)


# ── Request / response models ──────────────────────────────────────────────────


class MatrixRequest(BaseModel):
    """Payload for ``POST /api/matrix/analyze``."""

    topic: str = Field(max_length=500)
    elements: list[REElement] = Field(min_length=2, max_length=200)


class MatrixResponse(BaseModel):
    """Response from ``POST /api/matrix/analyze``.

    ``matrix`` is a square dict-of-dicts keyed by element ID with float
    relatedness scores in [0, 1]; diagonal entries are always 1.0.
    ``pair_descriptions`` maps ``"A→B"`` (IDs in JS sort order) to a
    one-sentence description of the relationship.
    """

    overview: str
    matrix: dict[str, dict[str, float]]
    pair_descriptions: dict[str, str] = Field(alias="pairDescriptions")
    model: str
    input_tokens: int = 0
    output_tokens: int = 0

    model_config = {"populate_by_name": True}


# ── Prompt ────────────────────────────────────────────────────────────────────


def _build_prompt(topic: str, elements: list[REElement]) -> str:
    """Build the LLM prompt for relatedness matrix computation.

    The prompt instructs the model to produce a symmetric matrix with
    diagonal 1.0 entries and a ``pairDescriptions`` dict keyed by
    ``"A→B"`` in JavaScript sort order (to match the frontend).
    """
    element_list = "\n".join(f"{e.id} [{e.type}]: {e.text}" for e in elements)
    ids = [e.id for e in elements]
    example_ids = ids[:3] if len(ids) >= 3 else ids

    return f"""\
You are assisting a reflective equilibrium (RE) analysis in ethics.
Topic: "{topic}"

Elements (judgments and principles):
{element_list}

Task: compute a symmetric relatedness matrix.
- Score each ordered pair (including diagonal) from 0.0 (completely unrelated) to 1.0 (identical or directly equivalent).
- Diagonal entries must be 1.0.
- For each off-diagonal unordered pair, provide a one-sentence description. \
Use the key "A→B" where A and B are sorted by JavaScript string sort order \
(e.g. ["J12","J10","J1","J3"].sort() → ["J1","J10","J12","J3"]).
- Write a 2–3 sentence overview of the overall element landscape.

Respond with valid JSON only, in exactly this format:
{{
  "overview": "...",
  "matrix": {{ {", ".join(f'"{i}": {{...}}' for i in example_ids)} }},
  "pairDescriptions": {{ "{example_ids[0]}→{example_ids[1]}": "Brief description." }}
}}"""


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/analyze", response_model=MatrixResponse)
async def analyze(
    request: MatrixRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> MatrixResponse:
    """Compute a relatedness matrix for the provided RE elements."""
    active = [
        e
        for e in request.elements
        if e.status != "withdrawn" and e.type in ("judgment", "principle")
    ]
    logger.info(
        f"Requesting relatedness matrix from model '{llm.model}' for {len(active)} elements."
    )
    prompt = _build_prompt(request.topic, active)
    result = await llm.complete_with_usage(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        json_mode=True,
    )
    data: dict[str, Any] = json.loads(result.text)
    logger.info("Received relatedness matrix from LLM.")
    return MatrixResponse(
        overview=data.get("overview", ""),
        matrix=data.get("matrix", {}),
        pairDescriptions=data.get("pairDescriptions", {}),
        model=llm.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )
