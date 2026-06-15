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
from typing import List, Dict
import logging

from theodias import StandardPosition

from .rethon_schemas import (
    SimulateRethonRequest,
    SimulateRethonStepRequest,
    SimulatedRethonResponse,
    ScorePerRoundRequest,
    ScorePerRoundResponse,
    RoundScores,
    ScoreChangesRequest,
    ScoreChangesResponse,
    QuickScoreRequest,
    QuickScoreResponse,
)
from ..services.rethon_simulation import (
    validate_and_build,
    get_rethon_final_state,
    build_re,
    reconstruct_re_state,
    compute_evolution_scores,
    translate_re_state,
    get_final_score,
)
from ..services.rethon_scoring import (
    compute_score_changes,
    compute_quick_score,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/simulate_rethon", tags=["simulate_rethon"])


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
    built_arguments, lookup_w_negated, n = validate_and_build(
        request.elements, request.relations, sentence_pool_minimum
    )
    try:
        if request.evolution:
            id_to_index: Dict[str, int] = {
                el.id: i + 1 for i, el in enumerate(request.elements)
            }
            reconstructed = reconstruct_re_state(request.evolution, id_to_index, n)
            init_coms = reconstructed.initial_commitments()
            re = build_re(
                built_arguments.num_arguments,
                n,
                init_coms,
                request.local,
                request.weights,
            )
            re.set_state(reconstructed)
            re.re_process()
        else:
            re = get_rethon_final_state(
                numerical_arguments=built_arguments.num_arguments,
                n_unnegated_sentence_pool=n,
                lookup=built_arguments.lookup,
                local=request.local,
                weights=request.weights,
            )
    except Exception as e:
        logger.error("Simulation failed: %s", e, exc_info=True)
        raise
    scores = compute_evolution_scores(re)
    return SimulatedRethonResponse(
        translated_arguments=built_arguments.translated_arguments,
        translated_re_state=translate_re_state(re.state(), lookup_w_negated, scores),
    )


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
    built_arguments, lookup_w_negated, n = validate_and_build(
        request.elements, request.relations, sentence_pool_minimum
    )
    try:
        id_to_index: Dict[str, int] = {
            el.id: i + 1 for i, el in enumerate(request.elements)
        }
        if request.evolution:
            reconstructed = reconstruct_re_state(request.evolution, id_to_index, n)
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
        re = build_re(
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
    scores = compute_evolution_scores(re)
    return SimulatedRethonResponse(
        translated_arguments=built_arguments.translated_arguments,
        translated_re_state=translate_re_state(re.state(), lookup_w_negated, scores),
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
                scores=get_final_score(
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
    """
    return compute_score_changes(
        request.elements, request.relations, request.local, request.weights
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
    return compute_quick_score(request.elements, request.relations, request.weights)
