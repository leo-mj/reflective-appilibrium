"""
Merge router — /api/merge

After two RE processes have been merged, asks the configured LLM which of their
elements make the same claim in different words, so the user can decide whether
to merge each pair into one element.

Which process an element came from is not part of ``REState``: the frontend keeps
it in ``state.processes`` and sends it with the request.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..dependencies import get_llm_service
from ..models.re_state import REElement
from ..services.llm import LLMService
from ..services.prompts import build_merge_pairs_prompt
from ..services.response_schemas import MERGE_PAIRS_SCHEMA
from .shared import LLMTaskResponse, parse_json_object

router = APIRouter(prefix="/api/merge", tags=["merge"])
logger = logging.getLogger(__name__)

# More than this is not a list anyone will work through card by card, and a
# model told to find every pair in a large state will otherwise run to the
# output cap mid-JSON.
MAX_PAIRS = 20


# ── Request / response models ──────────────────────────────────────────────────


class MergedProcess(BaseModel):
    """One process a merged state was put together from: its letter, its label
    (the user's topic or file name), and the ids of the elements it contributed."""

    id: str = Field(max_length=10)
    label: str = Field(default="", max_length=200)
    members: list[str] = Field(default_factory=list, max_length=1_000)

    model_config = {"extra": "ignore"}


class MergePairsRequest(BaseModel):
    """Payload for ``POST /api/merge/pairs``."""

    topic: str = Field(default="", max_length=500)
    elements: list[REElement] = Field(min_length=2, max_length=1_000)
    processes: list[MergedProcess] = Field(min_length=2, max_length=50)


class MergePair(BaseModel):
    """Two elements the model thinks make the same claim."""

    a: str
    b: str
    reason: str = ""


class MergePairsResponse(LLMTaskResponse):
    """Response from ``POST /api/merge/pairs``."""

    suggestions: list[MergePair]


# ── Helpers ────────────────────────────────────────────────────────────────────


def _process_index(processes: list[MergedProcess]) -> dict[str, set[str]]:
    """Element id → the letters of the processes it belongs to."""
    index: dict[str, set[str]] = {}
    for p in processes:
        for m in p.members:
            index.setdefault(m, set()).add(p.id)
    return index


def merge_pool(
    elements: list[REElement], processes: list[MergedProcess]
) -> list[tuple[REElement, list[str]]]:
    """The elements a pair may be drawn from, each with its process letters.

    An element in no process was added after the merge, so it cannot be half of
    a pair that spans two. ``possible`` elements are options nobody has affirmed.
    """
    index = _process_index(processes)
    order = {p.id: i for i, p in enumerate(processes)}
    return [
        (e, sorted(index[e.id], key=order.__getitem__))
        for e in elements
        if e.status != "possible" and e.id in index
    ]


def valid_pairs(
    raw: object, elements: list[REElement], processes: list[MergedProcess]
) -> list[MergePair]:
    """The proposed pairs that may actually be merged.

    The prompt asks for all of this, and a model does not always do what it is
    asked: unknown ids, pairs across types or with a process in common, and
    repeats in either order are dropped here rather than shown to the user.
    """
    if not isinstance(raw, list):
        return []
    index = _process_index(processes)
    by_id = {e.id: e for e in elements if e.status != "possible"}
    seen: set[frozenset[str]] = set()
    out: list[MergePair] = []
    for p in raw:
        if not isinstance(p, dict):
            continue
        a, b = p.get("a"), p.get("b")
        if not isinstance(a, str) or not isinstance(b, str) or a == b:
            continue
        key = frozenset((a, b))
        if key in seen:
            continue
        ea, eb = by_id.get(a), by_id.get(b)
        if ea is None or eb is None or ea.type != eb.type:
            continue
        pa, pb = index.get(a), index.get(b)
        if not pa or not pb or pa & pb:
            continue
        seen.add(key)
        reason = p.get("reason")
        out.append(
            MergePair(
                a=a, b=b, reason=reason[:1_000] if isinstance(reason, str) else ""
            )
        )
        if len(out) == MAX_PAIRS:
            break
    return out


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/pairs", response_model=MergePairsResponse)
async def suggest_merge_pairs(
    request: MergePairsRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> MergePairsResponse:
    """Ask the LLM which elements of the merged processes make the same claim."""
    pool = merge_pool(request.elements, request.processes)
    prompt = build_merge_pairs_prompt(
        request.topic, pool, {p.id: p.label for p in request.processes}
    )
    logger.info(
        f"Requesting merge pairs from model '{llm.model}' among {len(pool)} elements "
        f"of {len(request.processes)} processes."
    )
    result = await llm.complete_with_usage(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        json_mode=True,
        json_schema=MERGE_PAIRS_SCHEMA,
    )
    data = parse_json_object(result.text, llm.model)
    suggestions = valid_pairs(data.get("pairs"), request.elements, request.processes)
    logger.info(f"Received {len(suggestions)} usable merge pairs.")

    return MergePairsResponse(
        suggestions=suggestions,
        model=llm.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )
