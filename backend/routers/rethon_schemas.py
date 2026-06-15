"""Pydantic request/response models for the simulate_rethon router."""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator

from ..models.re_state import REElement, RERelation


class ModelWeights(BaseModel):
    """Rethon objective-function weights (account, systematicity, faithfulness) that must sum to 1.0."""

    account: float = Field(default=0.35, ge=0, le=1)
    systematicity: float = Field(default=0.55, ge=0, le=1)
    faithfulness: float = Field(default=0.1, ge=0, le=1)

    @model_validator(mode="after")
    def weights_sum_to_one(self) -> "ModelWeights":
        total = self.account + self.systematicity + self.faithfulness
        if abs(total - 1.0) > 1e-6:
            raise ValueError(
                f"Weights must sum to 1.0 (account + systematicity + faithfulness = {total:.6f})."
            )
        return self


class SimulateRethonRequest(BaseModel):
    """Payload for ``POST /api/simulate_rethon/simulate``."""

    round: str = Field(max_length=500)
    elements: list[REElement] = Field(min_length=1, max_length=200)
    relations: list[RERelation] = Field(default_factory=list, max_length=5_000)
    local: bool = True
    evolution: Optional[List[List[REElement]]] = None
    weights: Optional[ModelWeights] = None


class ZScores(BaseModel):
    """Achievement (Z) score and its three components for one evolution step."""

    z: float
    account: float
    systematicity: float
    faithfulness: float


class SimulatedRethonState(BaseModel):
    """Full translated evolution produced by a simulate or step endpoint.

    ``evolution``, ``step_types``, and ``scores`` are parallel lists: index ``i``
    holds the position, its label (``"commitments"`` or ``"theory"``), and its
    Z-score (``None`` for step 0 which has no theory yet).  ``alternatives`` are
    the alternative positions considered at each step.
    """

    finished: bool
    evolution: List[List[REElement]]
    # Parallel to evolution: "commitments" for even indices (C₀, C₁, …),
    # "theory" for odd indices (T₀, T₁, …).
    step_types: List[Literal["commitments", "theory"]]
    alternatives: List[List[REElement]]
    # Parallel to evolution: None for step 0 (no theory yet), scores otherwise.
    scores: List[Optional[ZScores]]


class SimulatedRethonResponse(BaseModel):
    """Response from ``POST /api/simulate_rethon/simulate``."""

    translated_arguments: list[List[REElement]]
    translated_re_state: SimulatedRethonState
    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0


class QuickScoreRequest(BaseModel):
    """Payload for ``POST /api/simulate_rethon/quick_score``."""

    elements: list[REElement] = Field(min_length=1, max_length=201)
    relations: list[RERelation] = Field(default_factory=list, max_length=5_000)
    weights: Optional[ModelWeights] = None


class QuickScoreResponse(BaseModel):
    """Response from ``POST /api/simulate_rethon/quick_score``.

    Returns only account and systematicity — faithfulness is omitted because
    in the type-based approach C₀ = C (no prior state), so faithfulness is
    always 1.0 and adds no information.
    """

    account: Optional[float]
    systematicity: Optional[float]


class RoundScores(BaseModel):
    """Equilibrium Z-score snapshot for one workflow round."""

    round: int
    scores: Optional[ZScores]


class ScorePerRoundResponse(BaseModel):
    """Response from ``POST /api/simulate_rethon/score_per_round``."""

    round_scores: List[RoundScores]


class ScorePerRoundRequest(BaseModel):
    """Payload for ``POST /api/simulate_rethon/score_per_round``.

    The server filters ``elements`` and ``relations`` to those present at each
    round before running the rethon simulation, so the full current lists should
    be sent.
    """

    elements: list[REElement] = Field(min_length=1, max_length=200)
    relations: list[RERelation] = Field(default_factory=list, max_length=5_000)
    round: int = Field(ge=1)
    local: bool = True
    weights: Optional[ModelWeights] = None


class ElementDelta(BaseModel):
    """Account and systematicity deltas for withdrawing one element."""

    element_id: str
    delta_account: Optional[float]
    delta_systematicity: Optional[float]


class ScoreChangesRequest(BaseModel):
    """Payload for ``POST /api/simulate_rethon/score_changes``."""

    elements: list[REElement] = Field(min_length=1, max_length=200)
    relations: list[RERelation] = Field(default_factory=list, max_length=5_000)
    local: bool = True
    weights: Optional[ModelWeights] = None


class ScoreChangesResponse(BaseModel):
    """Response from ``POST /api/simulate_rethon/score_changes``."""

    withdrawal_deltas: list[ElementDelta]


class SimulateRethonStepRequest(BaseModel):
    """Payload for ``POST /api/simulate_rethon/step``.

    On the first call omit ``evolution`` (or pass an empty list).  On every
    subsequent call pass the ``evolution`` from the previous response so the
    server can reconstruct the RE state and advance exactly one more step.
    All fields except ``evolution`` must be identical across calls for a given
    stepping session.
    """

    round: str = Field(max_length=500)
    elements: list[REElement] = Field(min_length=1, max_length=200)
    relations: list[RERelation] = Field(default_factory=list, max_length=5_000)
    local: bool = True
    evolution: Optional[List[List[REElement]]] = None
    weights: Optional[ModelWeights] = None
