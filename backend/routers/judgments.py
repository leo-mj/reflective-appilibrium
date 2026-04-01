"""
Judgments router — /api/judgments

Asks the configured LLM to present questions and thought experiments that
may elicit new moral judgments the user has not yet articulated.
"""
import logging
import json

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..dependencies import get_llm_service
from ..models.re_state import REElement, RELogEntry
from ..services.llm import LLMService

router = APIRouter(prefix="/api/judgments", tags=["judgments"])
logger = logging.getLogger(__name__)


# ── Request / response models ──────────────────────────────────────────────────

class ElicitJudgmentsRequest(BaseModel):
    topic: str = Field(max_length=500)
    elements: list[REElement] = Field(default_factory=list, max_length=200)
    log: list[RELogEntry] = Field(default_factory=list, max_length=1_000)


Confidence = Literal["high", "moderate", "low"]


class JudgmentSuggestion(BaseModel):
    question: str = Field(max_length=2_000)
    text: str = Field(max_length=2_000)
    confidence: Confidence


class ElicitJudgmentsResponse(BaseModel):
    suggestions: list[JudgmentSuggestion]
    model: str


# ── Prompt ────────────────────────────────────────────────────────────────────

def _build_prompt(
    topic: str,
    elements: list[REElement],
    log: list[RELogEntry],
) -> str:
    active = [e for e in elements if e.status not in {"withdrawn", "rejected"}]
    withdrawn = [e for e in elements if e.status == "withdrawn"]

    active_lines = (
        "\n".join(f"  {e.id} [{e.type}]: {e.text}" for e in active)
        if active else "  (none)"
    )
    withdrawn_lines = (
        "\n".join(f"  {e.id}: {e.text}" for e in withdrawn)
        if withdrawn else "  (none)"
    )
    log_lines = (
        "\n".join(
            f"  Round {entry.round}: {entry.findings}" for entry in log[-5:]
            if entry.findings
        )
        if log else "  (none)"
    )

    return f"""\
You are assisting a reflective equilibrium (RE) analysis in ethics.
Topic: "{topic}"

Current elements (active):
{active_lines}

Previously withdrawn elements (for context — these were reconsidered):
{withdrawn_lines}

Recent round notes:
{log_lines}

Task: identify 3–5 moral questions or thought experiments that are relevant \
to the topic and may prompt the user to articulate judgments they have not yet \
recorded. For each, also propose a tentative judgment the question is likely \
to elicit.

Guidelines:
- Target gaps: aspects of the topic the existing judgments do not yet address.
- Vary the angle: use cases from different ethical traditions, edge cases, \
near-miss scenarios, or analogies from other domains.
- Do not re-elicit judgments already present or withdrawn.
- Keep questions concise (1–2 sentences) and concrete.

Respond with valid JSON only, in exactly this format:
{{
  "suggestions": [
    {{
      "question": "A brief thought experiment or question.",
      "text": "Tentative judgment the question is likely to elicit.",
      "confidence": "high" | "moderate" | "low"
    }}
  ]
}}"""


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/elicit", response_model=ElicitJudgmentsResponse)
async def elicit_judgments(
    request: ElicitJudgmentsRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> ElicitJudgmentsResponse:
    """Ask the LLM for questions and thought experiments to elicit new judgments."""
    logger.info(
        f"Requesting judgment elicitation from LLM for topic '{request.topic}' "
        f"with {len(request.elements)} elements."
    )
    prompt = _build_prompt(request.topic, request.elements, request.log)
    raw = await llm.complete(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.6,
        json_mode=True,
    )
    data = json.loads(raw)
    suggestions = [JudgmentSuggestion(**s) for s in data.get("suggestions", [])]
    logger.info(f"Received {len(suggestions)} judgment elicitation suggestions from LLM.")

    return ElicitJudgmentsResponse(suggestions=suggestions, model=llm.model)
