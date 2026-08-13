"""
Pydantic models mirroring the RE state schema defined in app/src/types.js.

Keeping these in sync with the frontend schema is the contract between V1 and V2.
Files exported by the frontend (re-state JSON blocks) deserialise directly into
these models; the import security logic mirrors importMarkdown.js.
"""

from __future__ import annotations

from typing import Annotated, List, Literal, Optional, Union
from pydantic import BaseModel, Field, field_validator


# ── Element ────────────────────────────────────────────────────────────────────

ElementType = Literal["judgment", "principle", "theory"]
Status = Literal["active", "revised", "withdrawn", "rejected", "possible"]
Confidence = Annotated[float, Field(ge=0.0, le=1.0)]

HistoryEventType = Literal["withdrawn", "reinstated", "revised", "rejected"]


class REHistoryEvent(BaseModel):
    """One thing that happened to an element or relation, in a given round.

    Mirrors the ``REHistoryEvent`` typedef in app/src/types.js and the ``history``
    validator in app/src/utils/importMarkdown.js.  ``status`` and ``text`` are the
    projection of this list onto "now"; the list itself is the record of how the
    item got there, and an item may be withdrawn and reinstated any number of
    times.  It must therefore survive a round-trip through the session store —
    the legacy scalar fields below can express only a single withdrawal.
    """

    round: int
    type: HistoryEventType
    reason: Optional[str] = Field(None, max_length=2_000)
    previous_text: Optional[str] = Field(None, alias="previousText", max_length=10_000)

    model_config = {"populate_by_name": True}


# Confidence records how strongly *the user* holds an element, so it is not the
# LLM's to assign: suggestions are surfaced at the middle of the frontend's
# three-point scale (low 0.33 / moderate 0.67 / high 1.0 — see
# ``LEGACY_CONFIDENCE`` in app/src/utils/importMarkdown.js) and the user adjusts
# it on acceptance.  This is the same default the manual add-element panels use.
DEFAULT_CONFIDENCE: float = 0.67


class REElement(BaseModel):
    """A single node in the RE graph — a judgment, principle, or background theory.

    ``id`` follows the ``J<n>`` / ``P<n>`` / ``T<n>`` convention.
    Revised elements carry ``previous_text`` and ``revised_round``;
    withdrawn or rejected elements carry ``reason`` / ``withdrawn_round`` /
    ``rejected_round`` as appropriate.

    ``extra="forbid"``: the frontend is the source of this schema, so a field
    added to types.js that is missing here should fail loudly on the way in
    rather than be dropped on the way out — which is how ``history`` went
    missing from saved sessions.
    """

    id: str = Field(pattern=r"^[JPT]\d+$")
    type: ElementType
    status: Status
    confidence: Confidence
    origin: str = Field(max_length=200, default="")
    text: str = Field(max_length=10_000)
    added_round: int = Field(alias="addedRound", ge=1)
    negated: Optional[bool] = False

    # Revised fields
    previous_text: Optional[str] = Field(None, alias="previousText", max_length=10_000)
    revised_round: Optional[int] = Field(None, alias="revisedRound", ge=1)

    # Withdrawn fields
    reason: Optional[str] = Field(None, max_length=2_000)
    withdrawn_round: Optional[int] = Field(None, alias="withdrawnRound", ge=1)

    # Rejected fields
    rejected_round: Optional[int] = Field(None, alias="rejectedRound", ge=1)

    # Questionnaire fields
    questionnaire_index: Optional[int] = Field(None, alias="questionnaireIndex", ge=0)

    # The round-by-round record. The scalar *_round fields above are the older
    # single-event shape, still read from saved states; new writes use this.
    history: Optional[list[REHistoryEvent]] = Field(None, max_length=1_000)

    model_config = {"populate_by_name": True, "extra": "forbid"}


# ── Relation ───────────────────────────────────────────────────────────────────

RelationType = Literal[
    "supports",
    "conflicts",
    "undermines",
    "depends",
    "entails",
    "jointly_entails",
    "precludes",
    "jointly_precludes",
]


class RERelation(BaseModel):
    """A directed edge between two RE elements.

    ``from_id`` / ``to_id`` use the JSON aliases ``from`` / ``to`` to match
    the frontend schema.  A single ordered pair can have multiple relations
    (e.g. one ``supports`` and one ``undermines`` entry recorded separately).

    ``argument_id`` is set only for ``(jointly) entails`` relations: all premises of the
    same detected argument share the same ``argument_id`` so the graph can
    visually group them.
    """

    from_id: str = Field(alias="from", pattern=r"^[JPT]\d+$")
    to_id: str = Field(alias="to", pattern=r"^[JPT]\d+$")
    type: RelationType
    explanation: str = Field(max_length=2_000, default="")
    added_round: int = Field(alias="addedRound", ge=1)
    argument_id: Optional[str] = Field(None, alias="argumentId", max_length=200)
    origin: Optional[str] = Field(None, max_length=200)

    status: Optional[Status] = None
    revised_round: Optional[int] = Field(None, alias="revisedRound", ge=1)
    withdrawn_round: Optional[int] = Field(None, alias="withdrawnRound", ge=1)
    rejected_round: Optional[int] = Field(None, alias="rejectedRound", ge=1)

    # Tracked exactly as for elements — see REElement.history.
    history: Optional[list[REHistoryEvent]] = Field(None, max_length=1_000)

    model_config = {"populate_by_name": True, "extra": "forbid"}


# ── Log ────────────────────────────────────────────────────────────────────────


class RELogEntry(BaseModel):
    """Structured record of what happened in a single RE round.

    ``findings`` summarises observed coherence issues; ``options`` lists
    the adjustment proposals considered; ``decision`` records what the user
    chose; ``changes`` describes the resulting state mutations.
    """

    round: int = Field(ge=1)
    findings: str = Field(max_length=5_000, default="")
    options: str = Field(max_length=5_000, default="")
    decision: str = Field(max_length=5_000, default="")
    changes: str = Field(max_length=5_000, default="")


# ── Coherence ──────────────────────────────────────────────────────────────────


class RECoherence(BaseModel):
    """Snapshot of the coherence analysis at the end of a review round.

    Each list contains human-readable strings generated by the coherence
    checker (or the LLM):
    - ``tensions`` — conflicting or undermining pairs that have not been resolved.
    - ``orphans``  — elements with no relations to any other element.
    - ``clusters`` — descriptive labels for each identified coherent cluster.
    """

    tensions: list[str] = Field(default_factory=list, max_length=200)
    orphans: list[str] = Field(default_factory=list, max_length=200)
    clusters: list[str] = Field(default_factory=list, max_length=200)


# ── Questionnaire spec ─────────────────────────────────────────────────────────
#
# Mirrors validateQuestionnaireSpec in app/src/utils/importMarkdown.js, bound for
# bound. This used to be typed ``Any``: every other field on REState is
# size-capped, so an unvalidated one was the way to make the session store write
# a file of arbitrary size, and the only part of a saved session that reached
# disk without having been checked at all.


class QuestionnaireLink(BaseModel):
    """An inline link in a questionnaire card's description."""

    link: str = Field(default="", max_length=200)
    href: str = Field(default="", max_length=500)

    model_config = {"extra": "forbid"}

    @field_validator("href")
    @classmethod
    def _web_schemes_only(cls, v: str) -> str:
        """Reject anything that is not an ordinary web link.

        A spec can arrive in an imported file, and its description is rendered
        into an anchor. Without this the href is an arbitrary 500-character
        string, which is the shape a ``javascript:`` or ``data:`` URL takes.
        """
        if v and not v.startswith(("http://", "https://")):
            raise ValueError("href must be an http(s) URL")
        return v


class QuestionnaireCard(BaseModel):
    """The home-page card that offers a questionnaire."""

    title: str = Field(default="", max_length=500)
    description: Union[
        str,
        List[Union[Annotated[str, Field(max_length=2_000)], QuestionnaireLink]],
    ] = ""
    button_label: str = Field(default="", alias="buttonLabel", max_length=200)

    model_config = {"populate_by_name": True, "extra": "forbid"}

    @field_validator("description")
    @classmethod
    def _bounded(cls, v):
        if isinstance(v, str) and len(v) > 5_000:
            raise ValueError("description exceeds 5000 characters")
        if isinstance(v, list) and len(v) > 50:
            raise ValueError("description exceeds 50 items")
        return v


class QuestionnaireJudgment(BaseModel):
    """One selectable answer to a questionnaire question."""

    index: int
    id: str = Field(max_length=10)
    confidence: Confidence
    answer: str = Field(max_length=200)
    text: str = Field(max_length=10_000)

    model_config = {"extra": "forbid"}


class QuestionnaireSuggestion(BaseModel):
    """A question and the answers a participant may pick from."""

    question: str = Field(max_length=1_000)
    # Matches the bound in importMarkdown.js — see the note there on why it is
    # 100 rather than 20.
    judgments: list[QuestionnaireJudgment] = Field(default_factory=list, max_length=100)

    model_config = {"extra": "forbid"}


# An argument as indices into the questionnaire's sentence pool; the last entry
# is the conclusion, negative values mean negation.
ArgumentIndices = Annotated[list[int], Field(max_length=50)]


class QuestionnaireSpec(BaseModel):
    """A pre-populated argument graph the participant works through."""

    id: str = Field(default="", max_length=100)
    name: str = Field(default="", max_length=500)
    model: str = Field(default="", max_length=100)
    card: QuestionnaireCard = Field(default_factory=QuestionnaireCard)
    suggestions: list[QuestionnaireSuggestion] = Field(
        default_factory=list, max_length=100
    )
    participant_arguments: list[ArgumentIndices] = Field(
        default_factory=list, alias="participantArguments", max_length=100
    )
    further_arguments: list[ArgumentIndices] = Field(
        default_factory=list, alias="furtherArguments", max_length=100
    )

    model_config = {"populate_by_name": True, "extra": "forbid"}


# ── State ──────────────────────────────────────────────────────────────────────


class REState(BaseModel):
    """Complete serialisable state of a wide reflective equilibrium process.

    This is the canonical wire format shared between the frontend (types.js)
    and the backend.  The frontend exports JSON blocks that deserialise
    directly into this model; the backend routers accept subsets of it.
    ``phase`` is always 2 for the standalone app (phase 1 is the Claude Skill).
    """

    topic: str = Field(max_length=500, default="")
    phase: int = Field(default=2, ge=1)
    round: int = Field(ge=1)
    model: Optional[Literal["questionnaire"]] = None
    elements: list[REElement] = Field(default_factory=list, max_length=1_000)
    relations: list[RERelation] = Field(default_factory=list, max_length=5_000)
    coherence: RECoherence = Field(default_factory=RECoherence)
    log: list[RELogEntry] = Field(default_factory=list, max_length=1_000)
    questionnaire_spec: Optional[QuestionnaireSpec] = Field(
        None, alias="questionnaireSpec"
    )
