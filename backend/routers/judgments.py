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
    """Payload for ``POST /api/judgments/elicit``.

    ``elements`` is the full element list so the LLM can avoid re-eliciting
    judgments that are already recorded or withdrawn.  ``log`` provides recent
    round notes for additional context.
    """

    topic: str = Field(max_length=500)
    elements: list[REElement] = Field(default_factory=list, max_length=200)
    log: list[RELogEntry] = Field(default_factory=list, max_length=1_000)


Confidence = Literal["high", "moderate", "low"]


class JudgmentOption(BaseModel):
    """One of several jointly exhaustive positions a user might hold in response to a question."""

    text: str = Field(max_length=2_000)
    confidence: Confidence


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


# ── Prompt ────────────────────────────────────────────────────────────────────

def _build_prompt(
    topic: str,
    elements: list[REElement],
    log: list[RELogEntry],
) -> str:
    """Build the LLM prompt for judgment elicitation.

    Active and withdrawn elements are listed separately so the model can
    target genuine gaps rather than re-eliciting already-recorded positions.
    Only the five most recent log entries are included to stay within token limits.
    """
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
recorded.

For each question, provide 2–4 possible positions that together cover the main \
stances a person might hold in response to that question (jointly exhaustive \
alternatives). The user will accept the positions they agree with and reject the rest.

Guidelines:
- Target gaps: aspects of the topic the existing judgments do not yet address.
- Vary the angle: use cases from different ethical traditions, edge cases, \
near-miss scenarios, or analogies from other domains.
- Do not re-elicit judgments already present or withdrawn.
- Keep questions concise (1–2 sentences) and concrete.
- Each position should be a stand-alone moral verdict (not a rephrasing of the question).
- Positions within one question should be mutually exclusive — a user should be \
able to hold at most one without contradiction.

Respond with valid JSON only, in exactly this format:
{{
  "suggestions": [
    {{
      "question": "A brief thought experiment or question.",
      "judgments": [
        {{"text": "One plausible position in response to the question.", "confidence": "high"}},
        {{"text": "Another plausible position.", "confidence": "moderate"}},
        {{"text": "A more cautious or defeasible position.", "confidence": "low"}}
      ]
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
        f"Requesting judgment elicitation from model '{llm.model}' for topic '{request.topic}' "
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
    total_judgments = sum(len(s.judgments) for s in suggestions)
    logger.info(
        f"Received {len(suggestions)} judgment elicitation suggestions "
        f"({total_judgments} judgment options) from LLM."
    )

    return ElicitJudgmentsResponse(suggestions=suggestions, model=llm.model)
