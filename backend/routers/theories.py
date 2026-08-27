"""
Theories router — /api/theories

Asks the configured LLM for background theories that bear on the user's position,
then checks every reference it returns against Crossref before handing them back.

A suggestion is a theory and the works it is developed in — nothing about how it
relates to the elements already in the state. Which relations hold is the
Relations tab's job, and having a theory arrive pre-annotated would both duplicate
that and put the model's reading of the connection ahead of the user's. So the
selection criteria all live in the prompt (services/prompts.py), and none of them
is now enforceable here: what remains is discarding what the model was not
entitled to supply.
"""

import logging

from typing import Annotated, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..config import Settings, get_settings
from ..dependencies import get_llm_service
from ..models.re_state import (
    Confidence,
    DEFAULT_CONFIDENCE,
    REElement,
    RESource,
)
from ..services.crossref import VerificationState, verify
from ..services.llm import LLMService
from ..services.prompts import build_theories_prompt
from ..services.response_schemas import THEORIES_SCHEMA
from .shared import LLMTaskResponse, active_elements, parse_json_object

router = APIRouter(prefix="/api/theories", tags=["theories"])
logger = logging.getLogger(__name__)


# ── Request / response models ──────────────────────────────────────────────────


class SuggestTheoriesRequest(BaseModel):
    """Payload for ``POST /api/theories/suggest``."""

    topic: str = Field(max_length=500)
    elements: list[REElement] = Field(min_length=1, max_length=200)


class VerifiedSource(RESource):
    """A reference plus what checking it against Crossref concluded.

    ``verification`` is response-only and is deliberately *not* persisted onto the
    accepted element: a verdict is a snapshot that goes stale as Crossref indexes
    more, whereas the DOI a match yields is a fact.  A stored reference carrying a
    DOI is one that verified, which says the same thing and cannot rot.
    """

    verification: VerificationState = "unchecked"


class TheorySuggestion(BaseModel):
    """A single LLM-proposed background theory.

    ``confidence`` is always ``DEFAULT_CONFIDENCE`` — see ``JudgmentOption`` in
    the judgments router for why the model does not get to set it.
    """

    text: str = Field(max_length=2_000)
    confidence: Confidence = DEFAULT_CONFIDENCE
    sources: list[VerifiedSource] = Field(default_factory=list, max_length=5)


class SuggestTheoriesResponse(LLMTaskResponse):
    """Response from ``POST /api/theories/suggest``."""

    suggestions: list[TheorySuggestion]


# ── Validation ────────────────────────────────────────────────────────────────

# Which fields a reference needs before it can be rendered or looked up. A source
# missing its own is dropped: an article with no journal is not a citation, and
# sending it to Crossref would only produce a confident wrong match.
_REQUIRED_BY_TYPE = {
    "book": ("publisher",),
    "chapter": ("container", "publisher"),
    "article": ("container",),
}


def _clean_source(raw: dict) -> Optional[dict]:
    """A source with its model-supplied DOI stripped, or None if unusable.

    Discarding ``doi`` is belt-and-braces: it is absent from ``THEORIES_SCHEMA``,
    so a well-behaved provider has no field to fill, but a model replying in plain
    JSON mode is not bound by the schema and this endpoint must never present a
    model-invented identifier as though Crossref had returned it.
    """
    source = {k: v for k, v in raw.items() if k not in ("doi", "verification")}
    kind = source.get("type")
    if kind not in _REQUIRED_BY_TYPE:
        return None
    if not source.get("title") or not source.get("authors"):
        return None
    if any(not source.get(field) for field in _REQUIRED_BY_TYPE[kind]):
        return None
    return source


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/suggest", response_model=SuggestTheoriesResponse)
async def suggest_theories(
    request: SuggestTheoriesRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> SuggestTheoriesResponse:
    """Ask the LLM for background theories bearing on the position, and check their references."""
    active = active_elements(request.elements)
    judgments = [e for e in active if e.type == "judgment"]
    principles = [e for e in active if e.type == "principle"]
    theories = [e for e in active if e.type == "theory"]

    logger.info(
        f"Requesting background theories from model '{llm.model}' for "
        f"{len(judgments)} judgments and {len(principles)} principles."
    )
    prompt = build_theories_prompt(request.topic, judgments, principles, theories)
    result = await llm.complete_with_usage(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        json_mode=True,
        json_schema=THEORIES_SCHEMA,
    )
    data = parse_json_object(result.text, llm.model)

    suggestions: list[TheorySuggestion] = []
    for raw in data.get("suggestions", []):
        text = str(raw.get("text", "")).strip()
        if not text:
            logger.info("Dropping a theory suggestion with no text.")
            continue

        sources = []
        for raw_source in raw.get("sources", []):
            cleaned = (
                _clean_source(raw_source) if isinstance(raw_source, dict) else None
            )
            if cleaned is None:
                logger.info(
                    f"Dropped a source on {text[:60]!r}: missing the fields its "
                    "type requires."
                )
                continue
            sources.append(cleaned)

        # An empty source list is not a defect. Requiring a citation per
        # suggestion is how fabricated citations are produced, and plenty of
        # background theories are common property no single work owns.
        suggestions.append(
            TheorySuggestion.model_validate(
                {
                    "text": text,
                    "confidence": DEFAULT_CONFIDENCE,
                    "sources": sources,
                }
            )
        )

    await _check_references(suggestions, settings)

    logger.info(f"Returning {len(suggestions)} background theory suggestions.")
    return SuggestTheoriesResponse(
        suggestions=suggestions,
        model=llm.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )


async def _check_references(
    suggestions: list[TheorySuggestion], settings: Settings
) -> None:
    """Fill in each source's verdict and DOI, in place.

    Flattened into one call so the whole reply is checked with one bounded burst
    of concurrency rather than a burst per suggestion. ``verify`` never raises, so
    there is no failure path here: an outage arrives as "unchecked" on every
    reference, which is what the caller renders.
    """
    flat = [s for suggestion in suggestions for s in suggestion.sources]
    if not flat:
        return
    for source, verdict in zip(flat, await verify(flat, settings)):
        source.verification = verdict.state
        source.doi = verdict.doi
