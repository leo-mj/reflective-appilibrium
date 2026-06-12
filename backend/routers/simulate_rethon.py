"""
Simulate rethon router — /api/simulate_rethon

Runs formal reflective equilibrium computations via the theodias / rethon
Python packages and exposes the results to the frontend.  Five endpoints:

- ``/simulate``         — run a full RE process to fixed point (or resume from a
                          saved evolution).
- ``/step``             — advance one step at a time (stateless; pass the previous
                          evolution to resume).
- ``/score_per_round``  — compute the equilibrium Z-score at each workflow round.
- ``/quick_score``      — compute account and systematicity analytically without a
                          full simulation.
- ``/score_changes``    — batch withdrawal-delta analysis for all active elements.
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Literal, Optional, Union
from collections import defaultdict
from pydantic import BaseModel, Field, model_validator
import logging

from theodias import Position, StandardPosition, BDDDialecticalStructure
from rethon import (
    StandardLocalReflectiveEquilibrium,
    StandardGlobalReflectiveEquilibrium,
    REState,
)
from ..models.re_state import REElement, RERelation
from .arguments import DetectArgumentsResponse, translate_from_lookup

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/simulate_rethon", tags=["simulate_rethon"])

_REProcess = Union[
    StandardLocalReflectiveEquilibrium, StandardGlobalReflectiveEquilibrium
]


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


def _build_numerical_arguments(
    elements: List[REElement],
    relations: List[RERelation],
) -> DetectArgumentsResponse:
    """Build rethon-compatible lookup and argument lists from frontend relations."""
    lookup: Dict[int, REElement] = {i + 1: el for i, el in enumerate(elements)}
    id_to_index: Dict[str, int] = {el.id: i + 1 for i, el in enumerate(elements)}

    args_by_id: Dict[str, List[RERelation]] = defaultdict(list)
    for rel in relations:
        if rel.type in ("jointly_entails", "jointly_precludes") and rel.argument_id:
            args_by_id[rel.argument_id].append(rel)

    numerical_arguments: List[List[int]] = []
    for arg_rels in args_by_id.values():
        conclusion_idx = id_to_index.get(arg_rels[0].to_id)
        premise_indices = [id_to_index.get(rel.from_id) for rel in arg_rels]
        if conclusion_idx is None or any(idx is None for idx in premise_indices):
            logger.warning("Skipping argument with unknown element IDs.")
            continue
        if arg_rels[0].type == "jointly_precludes":
            conclusion_idx = -conclusion_idx
        numerical_arguments.append(
            [idx for idx in premise_indices if idx is not None] + [conclusion_idx]
        )

    translated_arguments = [
        translate_from_lookup(arg, lookup) for arg in numerical_arguments
    ]
    return DetectArgumentsResponse(
        num_arguments=numerical_arguments,
        translated_arguments=translated_arguments,
        lookup=lookup,
    )


def _add_negated_to_lookup(lookup: Dict) -> Dict:
    """Extend the lookup with negated copies of every element (negative key → ``negated=True``)."""
    return {
        **lookup,
        **{-k: e.model_copy(update={"negated": True}) for k, e in lookup.items()},
    }


def _get_rethon_final_state(
    numerical_arguments: List[List[int]],
    n_unnegated_sentence_pool: int,
    lookup: Dict[int, REElement],
    local: bool = True,
    weights: Optional[ModelWeights] = None,
) -> _REProcess:
    """Build a BDD dialectical structure, set initial commitments from the lookup, and run the full RE process to a fixed point.

    Uses ``StandardLocalReflectiveEquilibrium`` when ``local=True`` (considers
    only positions close to the current one) or
    ``StandardGlobalReflectiveEquilibrium`` otherwise (considers all positions;
    slow for sentence pools larger than ~10 elements).
    """
    logger.info("Beginning rethon simulation.")
    # Binary decision diagram - necessary for n_unnegated_sentence_pool > 10
    bdd_ds = BDDDialecticalStructure.from_arguments(
        arguments=numerical_arguments,
        n_unnegated_sentence_pool=n_unnegated_sentence_pool,
    )
    initial_position = {
        index if element.status in ("active", "revised") else -index
        for index, element in lookup.items()
        if element.status in ("active", "revised", "rejected")
    }
    init_coms = StandardPosition.from_set(
        position=initial_position,
        n_unnegated_sentence_pool=n_unnegated_sentence_pool,
    )
    if local:
        # Consider positions close to current positions
        re = StandardLocalReflectiveEquilibrium(
            dialectical_structure=bdd_ds, initial_commitments=init_coms
        )
    else:
        # Consider all positions; slow for n_unnegated_sentence_pool > 10
        re = StandardGlobalReflectiveEquilibrium(
            dialectical_structure=bdd_ds, initial_commitments=init_coms
        )
    if weights is not None:
        re.set_model_parameters({"weights": weights.model_dump()})
    re.re_process()
    logger.info("Completed rethon simulation.")
    return re


def _build_re(
    numerical_arguments: List[List[int]],
    n_unnegated_sentence_pool: int,
    init_coms: Position,
    local: bool = True,
    weights: Optional[ModelWeights] = None,
) -> _REProcess:
    """Build and initialise a rethon RE object without running any steps."""
    bdd_ds = BDDDialecticalStructure.from_arguments(
        arguments=numerical_arguments,
        n_unnegated_sentence_pool=n_unnegated_sentence_pool,
    )
    if local:
        re: _REProcess = StandardLocalReflectiveEquilibrium(
            dialectical_structure=bdd_ds, initial_commitments=init_coms
        )
    else:
        re = StandardGlobalReflectiveEquilibrium(
            dialectical_structure=bdd_ds, initial_commitments=init_coms
        )
    if weights is not None:
        re.set_model_parameters({"weights": weights.model_dump()})
    return re


def _reconstruct_re_state(
    evolution: List[List[REElement]],
    id_to_index: Dict[str, int],
    n_unnegated_sentence_pool: int,
) -> REState:
    """Rebuild an REState from a previously translated evolution.

    Each position is a list of REElements (with negated=True for negated
    sentences). We map element IDs back to numerical sentence indices and
    reconstruct a StandardPosition for each step.  The alternatives are left
    empty — they are informational only and do not affect future steps.
    """
    positions = []
    for pos_elements in evolution:
        indices: set[int] = set()
        for el in pos_elements:
            idx = id_to_index.get(el.id)
            if idx is None:
                logger.warning("Unknown element id %s in evolution; skipping.", el.id)
                continue
            indices.add(-idx if el.negated else idx)
        positions.append(StandardPosition.from_set(indices, n_unnegated_sentence_pool))
    state = REState(
        finished=False,
        evolution=positions,
        alternatives=[set() for _ in positions],
        time_line=list(range(len(positions))),
    )
    # Re-evaluate the fixed-point condition on the reconstructed positions.
    # StandardReflectiveEquilibrium.finished() checks this same logic, but
    # requires an RE object we don't have here.  The condition is a pure
    # function of the evolution (no dialectical structure access needed), so
    # it is safe to compute inline.
    state.finished = (
        len(state) > 3
        and not state.next_step_is_theory()
        and state.last_commitments() == state.past_commitments(-1)
        and state.last_theory() == state.past_theory(-1)
    )
    return state


def _compute_evolution_scores(re: _REProcess) -> List[Optional[ZScores]]:
    """Compute Z-score and its three components for each step in the evolution.

    Even-indexed steps are commitments positions; odd-indexed steps are theory
    positions.  Step 0 has no theory yet so its score is ``None``.  Every other
    step gets a ``ZScores`` computed from the most recent (commitments, theory)
    pair and the initial commitments (C₀ = evolution[0]).
    """
    evolution = re.state().evolution
    if not evolution:
        return []
    initial_commitments = evolution[0]
    scores: List[Optional[ZScores]] = []
    last_commitments = None
    last_theory = None
    for i, pos in enumerate(evolution):
        if i % 2 == 0:  # commitments step
            last_commitments = pos
            if last_theory is None:
                scores.append(None)  # C₀ — no theory available yet
            else:
                scores.append(
                    ZScores(
                        z=re.achievement(
                            last_commitments, last_theory, initial_commitments
                        ),
                        account=re.account(last_commitments, last_theory),
                        systematicity=re.systematicity(last_theory),
                        faithfulness=re.faithfulness(
                            last_commitments, initial_commitments
                        ),
                    )
                )
        else:  # theory step
            last_theory = pos
            if last_commitments is None:
                scores.append(None)  # shouldn't happen but guard for type safety
            else:
                scores.append(
                    ZScores(
                        z=re.achievement(
                            last_commitments, last_theory, initial_commitments
                        ),
                        account=re.account(last_commitments, last_theory),
                        systematicity=re.systematicity(last_theory),
                        faithfulness=re.faithfulness(
                            last_commitments, initial_commitments
                        ),
                    )
                )
    return scores


def _get_final_score(
    elements: List[REElement],
    relations: List[RERelation],
    local: bool = True,
    weights: Optional[ModelWeights] = None,
) -> Optional[ZScores]:
    """Run a full RE simulation and return only the final equilibrium Z-score.

    Returns ``None`` when the simulation cannot be run (too few elements, no
    arguments, or any other error).
    """
    try:
        built, _, n = _validate_and_build(elements, relations, sentence_pool_minimum=3)
        re = _get_rethon_final_state(
            numerical_arguments=built.num_arguments,
            n_unnegated_sentence_pool=n,
            lookup=built.lookup,
            local=local,
            weights=weights,
        )
        scores_list = _compute_evolution_scores(re)
        return next((s for s in reversed(scores_list) if s is not None), None)
    except Exception:
        return None


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


def _translate_re_state(
    numerical_re_state: REState,
    lookup: Dict[int, REElement],
    scores: Optional[List[Optional[ZScores]]] = None,
) -> SimulatedRethonState:
    """Translate a numerical rethon REState into a frontend-typed SimulatedRethonState.

    Each position in the evolution (a set of signed sentence indices) is mapped
    to a list of REElements via ``translate_from_lookup``.  The negated lookup
    (negative keys) must be passed so negated elements translate correctly.
    """
    logger.info("Translating rethon RE state.")
    re_state_dict = numerical_re_state.as_dict()
    evolution = re_state_dict["evolution"]
    result = SimulatedRethonState(
        finished=re_state_dict["finished"],
        evolution=[translate_from_lookup(pos.as_list(), lookup) for pos in evolution],
        step_types=[
            "commitments" if i % 2 == 0 else "theory" for i in range(len(evolution))
        ],
        alternatives=[
            translate_from_lookup(alt.as_list(), lookup)
            for alt_set in re_state_dict["alternatives"]
            for alt in alt_set
        ],
        scores=scores if scores is not None else [None] * len(evolution),
    )
    logger.info("Completed translating rethon RE state.")
    return result


def _validate_and_build(
    elements: List[REElement],
    relations: List[RERelation],
    sentence_pool_minimum: int = 3,
) -> tuple[DetectArgumentsResponse, Dict[int, REElement], int]:
    """Validate the request payload and build the numerical argument structures.

    Raises HTTPException on invalid input.  Returns the built arguments, the
    negated lookup, and the sentence pool size.
    """
    n = len(elements)
    if n < sentence_pool_minimum:
        raise HTTPException(
            status_code=422,
            detail=f"There are fewer than {sentence_pool_minimum} elements forming the sentence pool.",
        )
    arg_relations = [
        r for r in relations if r.type in ("jointly_entails", "jointly_precludes")
    ]
    if not arg_relations:
        raise HTTPException(
            status_code=422,
            detail="No argument relations found. Accept arguments in the Detect Arguments tab first.",
        )
    built_arguments = _build_numerical_arguments(
        elements=elements, relations=arg_relations
    )
    lookup_w_negated = _add_negated_to_lookup(lookup=built_arguments.lookup)
    return built_arguments, lookup_w_negated, n


@router.post("/simulate", response_model=SimulatedRethonResponse)
async def simulate_rethon(
    request: SimulateRethonRequest,
    sentence_pool_minimum: int = 3,
) -> SimulatedRethonResponse:
    """Run the RE process to a fixed point and return the translated evolution with Z-scores.

    If ``request.evolution`` is supplied the process is resumed from that
    checkpoint (the saved evolution is reconstructed and the simulation continues
    from where it left off).  Otherwise the simulation starts fresh from the
    element statuses in the request.

    Raises 422 if the sentence pool is too small or no argument relations are present.
    """
    built_arguments, lookup_w_negated, n = _validate_and_build(
        request.elements, request.relations, sentence_pool_minimum
    )
    try:
        if request.evolution:
            id_to_index: Dict[str, int] = {
                el.id: i + 1 for i, el in enumerate(request.elements)
            }
            reconstructed = _reconstruct_re_state(request.evolution, id_to_index, n)
            init_coms = reconstructed.initial_commitments()
            re = _build_re(
                built_arguments.num_arguments,
                n,
                init_coms,
                request.local,
                request.weights,
            )
            re.set_state(reconstructed)
            re.re_process()
        else:
            re = _get_rethon_final_state(
                numerical_arguments=built_arguments.num_arguments,
                n_unnegated_sentence_pool=n,
                lookup=built_arguments.lookup,
                local=request.local,
                weights=request.weights,
            )
    except Exception as e:
        logger.error("Simulation failed: %s", e, exc_info=True)
        raise
    scores = _compute_evolution_scores(re)
    return SimulatedRethonResponse(
        translated_arguments=built_arguments.translated_arguments,
        translated_re_state=_translate_re_state(re.state(), lookup_w_negated, scores),
    )


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


@router.post("/step", response_model=SimulatedRethonResponse)
async def simulate_rethon_step(
    request: SimulateRethonStepRequest,
    sentence_pool_minimum: int = 3,
) -> SimulatedRethonResponse:
    """Advance the RE process by exactly one step and return the updated evolution.

    On the first call omit ``request.evolution`` (or pass an empty list) — the
    simulation starts from the element statuses.  On each subsequent call pass
    the ``translated_re_state.evolution`` from the previous response to resume.
    All fields except ``evolution`` must be identical across calls for a given
    stepping session.  Returns 400 if the process has already reached a fixed point.
    """
    built_arguments, lookup_w_negated, n = _validate_and_build(
        request.elements, request.relations, sentence_pool_minimum
    )
    try:
        id_to_index: Dict[str, int] = {
            el.id: i + 1 for i, el in enumerate(request.elements)
        }
        if request.evolution:
            reconstructed = _reconstruct_re_state(request.evolution, id_to_index, n)
            init_coms = reconstructed.initial_commitments()
        else:
            init_coms = StandardPosition.from_set(
                position={
                    (
                        id_to_index[el.id]
                        if el.status in ("active", "revised")
                        else -id_to_index[el.id]
                    )
                    for el in request.elements
                    if el.status in ("active", "revised", "rejected")
                },
                n_unnegated_sentence_pool=n,
            )
        re = _build_re(
            numerical_arguments=built_arguments.num_arguments,
            n_unnegated_sentence_pool=n,
            init_coms=init_coms,
            local=request.local,
            weights=request.weights,
        )
        if request.evolution:
            re.set_state(reconstructed)
        if re.state().finished:
            raise HTTPException(
                status_code=400,
                detail="The RE process has already reached a fixed point.",
            )
        re.next_step()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Step simulation failed: %s", e, exc_info=True)
        raise
    scores = _compute_evolution_scores(re)
    return SimulatedRethonResponse(
        translated_arguments=built_arguments.translated_arguments,
        translated_re_state=_translate_re_state(re.state(), lookup_w_negated, scores),
    )


@router.post("/score_per_round", response_model=ScorePerRoundResponse)
async def score_per_round(
    request: ScorePerRoundRequest,
) -> ScorePerRoundResponse:
    """Compute the equilibrium Z-score for each workflow round from 1 to *request.round*.

    Elements and relations are filtered to those present at each round before
    running the rethon simulation.  Rounds where the simulation fails (e.g. not
    enough elements or no arguments yet) are returned with ``scores=None``.
    """
    results: List[RoundScores] = []
    for r in range(1, request.round + 1):
        # Elements present at round r: added by r AND not yet withdrawn at r
        elements_at_r = [
            el
            for el in request.elements
            if (el.added_round or 1) <= r
            and not (el.withdrawn_round and el.withdrawn_round <= r)
        ]
        el_ids = {el.id for el in elements_at_r}
        # Relations present at round r: added by r, both endpoints still exist
        relations_at_r = [
            rel
            for rel in request.relations
            if (rel.added_round or 1) <= r
            and rel.from_id in el_ids
            and rel.to_id in el_ids
        ]
        results.append(
            RoundScores(
                round=r,
                scores=_get_final_score(
                    elements_at_r, relations_at_r, request.local, request.weights
                ),
            )
        )
    return ScorePerRoundResponse(round_scores=results)


@router.post("/score_changes", response_model=ScoreChangesResponse)
async def score_changes(request: ScoreChangesRequest) -> ScoreChangesResponse:
    """Batch-compute withdrawal Z-score deltas for all active/revised elements.

    Uses an analytical approach: judgment elements form the commitment position
    (C) and principle/theory elements form the theory position (T).  Z is
    computed directly from ``re_obj.achievement(C, T, C₀)`` — no full RE
    simulation is run.

    - Withdrawing a **judgment** removes it from C; T is held fixed.
    - Withdrawing a **principle** or **theory** removes it from T; C is held fixed.

    This gives distinct, meaningful deltas per element and no longer requires
    the simulation evolution to be available.
    """
    elements = request.elements
    n = len(elements)

    target_elements = [
        el
        for el in elements
        if el.status in ("active", "revised")
        and el.type in ("judgment", "principle", "theory")
    ]
    empty = ScoreChangesResponse(
        withdrawal_deltas=[
            ElementDelta(element_id=el.id, delta_account=None, delta_systematicity=None)
            for el in target_elements
        ],
    )

    if n < 3:
        return empty
    arg_relations = [
        r
        for r in request.relations
        if r.type in ("jointly_entails", "jointly_precludes")
    ]
    if not arg_relations:
        return empty

    try:
        built = _build_numerical_arguments(elements=elements, relations=arg_relations)
        id_to_index: Dict[str, int] = {el.id: i + 1 for i, el in enumerate(elements)}

        bdd_ds = BDDDialecticalStructure.from_arguments(
            arguments=built.num_arguments,
            n_unnegated_sentence_pool=n,
        )

        # C₀: all active/revised (positive) and rejected (negative) elements.
        # T*: only principle and theory elements that are active/revised.
        # Principles and background theories appear in both C₀ and T*.
        c0_set: set[int] = {
            (
                id_to_index[el.id]
                if el.status in ("active", "revised")
                else -id_to_index[el.id]
            )
            for el in elements
            if el.status in ("active", "revised", "rejected")
        }
        t_set: set[int] = {
            id_to_index[el.id]
            for el in elements
            if el.type in ("principle", "theory") and el.status in ("active", "revised")
        }
        if not t_set:
            return empty  # No theory position — Z cannot be computed.

        c0_pos = StandardPosition.from_set(c0_set, n)
        t_pos = StandardPosition.from_set(t_set, n)

        re_obj: _REProcess = StandardLocalReflectiveEquilibrium(
            dialectical_structure=bdd_ds, initial_commitments=c0_pos
        )
        if request.weights is not None:
            re_obj.set_model_parameters({"weights": request.weights.model_dump()})

        # Baseline account and systematicity: C = C₀, T = T*.
        baseline_account = re_obj.account(c0_pos, t_pos)
        baseline_systematicity = re_obj.systematicity(t_pos)

        withdrawal_deltas: List[ElementDelta] = []
        for el in target_elements:
            try:
                idx = id_to_index[el.id]  # always positive for active/revised
                if el.type == "judgment":
                    # Judgments live only in C — remove from C, T unchanged.
                    c_mod_pos = StandardPosition.from_set(c0_set - {idx}, n)
                    delta_account = re_obj.account(c_mod_pos, t_pos) - baseline_account
                    delta_systematicity = 0.0  # T unchanged
                else:
                    # Principles/theories live in both C and T — remove from both.
                    c_mod_pos = StandardPosition.from_set(c0_set - {idx}, n)
                    t_mod_pos = StandardPosition.from_set(t_set - {idx}, n)
                    delta_account = (
                        re_obj.account(c_mod_pos, t_mod_pos) - baseline_account
                    )
                    delta_systematicity = (
                        re_obj.systematicity(t_mod_pos) - baseline_systematicity
                    )
            except Exception:
                delta_account = None
                delta_systematicity = None
            withdrawal_deltas.append(
                ElementDelta(
                    element_id=el.id,
                    delta_account=delta_account,
                    delta_systematicity=delta_systematicity,
                )
            )

        return ScoreChangesResponse(withdrawal_deltas=withdrawal_deltas)
    except Exception:
        return empty


def _build_type_positions(
    elements: List[REElement],
    id_to_index: Dict[str, int],
    n: int,
) -> tuple[Position, Position]:
    """Build commitment (C) and theory (T) positions from element types.

    - **All** elements (judgments, principles, background theories) that are
      active/revised (→ positive) or rejected (→ negative) form the commitment
      position.  An agent can be committed to a principle just as much as to a
      particular judgment.
    - Only principle and background-theory (type "theory") elements that are
      active/revised form the theory position, because these are the elements
      that constitute the explanatory framework.

    Principles and background theories therefore appear in *both* C and T.

    Allows Z to be computed analytically without running a full RE simulation.
    Returns ``(c_pos, t_pos)``.
    """
    c_set: set[int] = {
        (
            id_to_index[el.id]
            if el.status in ("active", "revised")
            else -id_to_index[el.id]
        )
        for el in elements
        if el.status in ("active", "revised", "rejected") and el.id in id_to_index
    }
    t_set: set[int] = {
        id_to_index[el.id]
        for el in elements
        if el.type in ("principle", "theory")
        and el.status in ("active", "revised")
        and el.id in id_to_index
    }
    return (
        StandardPosition.from_set(c_set, n),
        StandardPosition.from_set(t_set, n),
    )


@router.post("/quick_score", response_model=QuickScoreResponse)
async def quick_score(request: QuickScoreRequest) -> QuickScoreResponse:
    """Compute account and systematicity for the current element set analytically.

    Derives C (all active/revised/rejected elements) and T (active/revised
    principle/theory elements) directly from element types — no simulation or
    prior evolution is required.

    Returns ``account=null, systematicity=null`` when there are fewer than 3
    elements, no argument relations, or no active principle/theory elements.
    """
    try:
        n = len(request.elements)
        if n < 3:
            return QuickScoreResponse(account=None, systematicity=None)

        arg_relations = [
            r
            for r in request.relations
            if r.type in ("jointly_entails", "jointly_precludes")
        ]
        if not arg_relations:
            return QuickScoreResponse(account=None, systematicity=None)

        if not any(
            el.type in ("principle", "theory") and el.status in ("active", "revised")
            for el in request.elements
        ):
            return QuickScoreResponse(account=None, systematicity=None)

        built = _build_numerical_arguments(
            elements=request.elements, relations=arg_relations
        )
        id_to_index: Dict[str, int] = {
            el.id: i + 1 for i, el in enumerate(request.elements)
        }

        bdd_ds = BDDDialecticalStructure.from_arguments(
            arguments=built.num_arguments,
            n_unnegated_sentence_pool=n,
        )

        c_pos, t_pos = _build_type_positions(request.elements, id_to_index, n)

        # RE object used only for its scoring methods — no re_process() call.
        re_obj: _REProcess = StandardLocalReflectiveEquilibrium(
            dialectical_structure=bdd_ds, initial_commitments=c_pos
        )
        if request.weights:
            re_obj.set_model_parameters({"weights": request.weights.model_dump()})

        return QuickScoreResponse(
            account=re_obj.account(c_pos, t_pos),
            systematicity=re_obj.systematicity(t_pos),
        )
    except Exception:
        return QuickScoreResponse(account=None, systematicity=None)
