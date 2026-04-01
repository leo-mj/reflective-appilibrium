"""
Pydantic models mirroring the RE state schema defined in app/src/types.js.

Keeping these in sync with the frontend schema is the contract between V1 and V2.
Files exported by the frontend (re-state JSON blocks) deserialise directly into
these models; the import security logic mirrors importMarkdown.js.
"""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


# ── Element ────────────────────────────────────────────────────────────────────

ElementType = Literal["judgment", "principle", "theory"]
Status = Literal["active", "revised", "withdrawn", "rejected"]
Confidence = Literal["high", "moderate", "low"]


class REElement(BaseModel):
    id: str = Field(pattern=r"^[JPT]\d+$")
    type: ElementType
    status: Status
    confidence: Confidence
    origin: str = Field(max_length=200, default="")
    text: str = Field(max_length=10_000)
    added_round: int = Field(alias="addedRound", ge=1)

    # Revised fields
    previous_text: Optional[str] = Field(None, alias="previousText", max_length=10_000)
    revised_round: Optional[int] = Field(None, alias="revisedRound", ge=1)

    # Withdrawn fields
    reason: Optional[str] = Field(None, max_length=2_000)
    withdrawn_round: Optional[int] = Field(None, alias="withdrawnRound", ge=1)

    # Rejected fields
    rejected_round: Optional[int] = Field(None, alias="rejectedRound", ge=1)

    model_config = {"populate_by_name": True}


# ── Relation ───────────────────────────────────────────────────────────────────

RelationType = Literal["supports", "conflicts", "undermines", "depends"]


class RERelation(BaseModel):
    from_id: str = Field(alias="from", pattern=r"^[JPT]\d+$")
    to_id: str = Field(alias="to", pattern=r"^[JPT]\d+$")
    type: RelationType
    explanation: str = Field(max_length=2_000, default="")
    added_round: int = Field(alias="addedRound", ge=1)

    status: Optional[Status] = None
    revised_round: Optional[int] = Field(None, alias="revisedRound", ge=1)
    withdrawn_round: Optional[int] = Field(None, alias="withdrawnRound", ge=1)
    rejected_round: Optional[int] = Field(None, alias="rejectedRound", ge=1)

    model_config = {"populate_by_name": True}


# ── Log ────────────────────────────────────────────────────────────────────────

class RELogEntry(BaseModel):
    round: int = Field(ge=1)
    findings: str = Field(max_length=5_000, default="")
    options: str = Field(max_length=5_000, default="")
    decision: str = Field(max_length=5_000, default="")
    changes: str = Field(max_length=5_000, default="")


# ── Coherence ──────────────────────────────────────────────────────────────────

class RECoherence(BaseModel):
    tensions: list[str] = Field(default_factory=list, max_length=200)
    orphans: list[str] = Field(default_factory=list, max_length=200)
    clusters: list[str] = Field(default_factory=list, max_length=200)


# ── State ──────────────────────────────────────────────────────────────────────

class REState(BaseModel):
    topic: str = Field(max_length=500, default="")
    phase: int = Field(default=2, ge=1)
    round: int = Field(ge=1)
    elements: list[REElement] = Field(default_factory=list, max_length=1_000)
    relations: list[RERelation] = Field(default_factory=list, max_length=5_000)
    coherence: RECoherence = Field(default_factory=RECoherence)
    log: list[RELogEntry] = Field(default_factory=list, max_length=1_000)
