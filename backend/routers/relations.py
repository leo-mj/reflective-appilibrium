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

router = APIRouter(prefix="/api/relations", tags=["relations"])
logger = logging.getLogger(__name__)



# ── Request / response models ──────────────────────────────────────────────────

class SuggestRequest(BaseModel):
    topic: str = Field(max_length=500)
    elements: list[REElement] = Field(min_length=2, max_length=200)
    existing_relations: list[RERelation] = Field(default_factory=list, max_length=5_000)


class RelationSuggestion(BaseModel):
    from_id: str = Field(alias="from")
    to_id: str = Field(alias="to")
    type: RelationType
    explanation: str

    model_config = {"populate_by_name": True}


class SuggestResponse(BaseModel):
    suggestions: list[RelationSuggestion]
    model: str


# ── Prompt ────────────────────────────────────────────────────────────────────

_RELATION_RULES = """\
Relation types (all are directional — check both A→B and B→A):
- supports: A provides positive reason for B (evidential, explanatory, or logical)
- conflicts: A and B are incompatible; holding both generates contradiction or incoherence
- undermines: A weakens B without flatly contradicting it; reduces plausibility or confidence
- depends: A presupposes B; A cannot hold (or loses its grounding) if B is withdrawn

A single pair can have multiple relations (e.g. P supports J in one respect but undermines it in another). Record each separately.
When in doubt whether a relation exists, include it — the user can reject it. Missing connections degrade coherence evaluation."""


def _build_prompt(
    topic: str,
    elements: list[REElement],
    existing_relations: list[RERelation],
) -> str:
    element_lines = "\n".join(
        f"{e.id} [{e.type}]: {e.text}" for e in elements
    )

    skip_pairs: set[tuple[str, str]] = set()
    for r in existing_relations:
        skip_pairs.add((r.from_id, r.to_id))

    if skip_pairs:
        skip_lines = "\n".join(f"  {a} → {b}" for a, b in sorted(skip_pairs))
        skip_section = f"\nAlready recorded (do not re-suggest these directed pairs):\n{skip_lines}\n"
    else:
        skip_section = ""

    return f"""\
You are assisting a reflective equilibrium (RE) analysis in ethics.
Topic: "{topic}"

Elements:
{element_lines}
{skip_section}
{_RELATION_RULES}

Task: identify ALL relations that hold between any two elements above (both directions), \
excluding already-recorded pairs listed above.

Respond with valid JSON only, in exactly this format:
{{
  "relations": [
    {{"from": "J1", "to": "P2", "type": "supports", "explanation": "One sentence."}}
  ]
}}

If no new relations are found, return {{"relations": []}}."""


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/suggest", response_model=SuggestResponse)
async def suggest_relations(
    request: SuggestRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> SuggestResponse:
    """Ask the LLM to identify relations between the provided RE elements."""
    active = [e for e in request.elements if e.status != "withdrawn"]
    prompt = _build_prompt(request.topic, active, request.existing_relations)
    logger.info(f"Requesting relation suggestions from LLM between {len(active)} active elements.")
    raw = await llm.complete(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        json_mode=True,
    )
    data = json.loads(raw)
    suggestions = [RelationSuggestion(**r) for r in data.get("relations", [])]
    logger.info(f"Received LLM suggestions for {len(suggestions)} new relations.")

    return SuggestResponse(suggestions=suggestions, model=llm.model)
