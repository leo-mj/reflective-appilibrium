"""
Simulate rethon router — /api/simulate_rethon

Runs formal reflective equilibrium computations via the theodias / rethon
Python packages and exposes the results to the frontend.  Five endpoints over
two routers, which share a prefix and differ only in what they cost:

``router`` — runs a whole process in one request, and is rate limited tightly:

- ``/simulate``         — run a full RE process to fixed point (or resume from a
                          saved evolution).
- ``/score_per_round``  — compute the equilibrium Z-score at each workflow round.
                          R simulations per request, so the most expensive of all.

``stepping_router`` — as costly per call, but called once per press:

- ``/step``             — advance one step at a time (stateless; pass the previous
                          evolution to resume).

``scoring_router`` — answers analytically, and is called constantly:

- ``/quick_score``      — compute account and systematicity analytically without a
                          full simulation.
- ``/score_changes``    — batch withdrawal-delta analysis for all active elements.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from typing import Annotated, Awaitable, Callable, TypeVar, Union
import asyncio
import logging

from .rethon_schemas import (
    SimulateRethonRequest,
    SimulateRethonStepRequest,
    SimulatedRethonResponse,
    ScorePerRoundRequest,
    ScorePerRoundResponse,
    ScoreChangesRequest,
    ScoreChangesResponse,
    QuickScoreRequest,
    QuickScoreResponse,
)
from ..config import Settings, get_settings
from ..process_pool import ComputationStopped, run_in_pool
from ..services.rethon_simulation import (
    SimulationFinished,
    enforce_element_cap,
    simulate_one_step,
    simulate_to_fixed_point,
    validate_and_build,
)
from ..services.rethon_scoring import (
    compute_score_changes,
    compute_quick_score,
    compute_score_per_round,
)

logger = logging.getLogger(__name__)

# Two routers over one prefix, split by cost rather than by subject, because the
# rate limit is attached at `include_router` in main.py and that is the only
# thing separating them.
#
# Doing it with per-route dependencies instead would have been fewer lines and
# would have broken the rule main.py:72-75 states: a gate applied at the router
# is a gate a new endpoint inherits, and forgetting to add the dependency is
# exactly the mistake worth designing out. An endpoint added to the wrong one of
# these two is mis-limited; an endpoint added to a router with no gate at all is
# unlimited, which is worse.
#
# `router` keeps its name and the expensive endpoints: anything added without
# thinking about which of the two it belongs in lands under the smaller cap,
# which is the safe direction to be wrong in.
router = APIRouter(prefix="/api/simulate_rethon", tags=["simulate_rethon"])

# /step alone. Costs what a simulation costs and is pressed once per step, which
# is a combination neither of the other two buckets can hold.
stepping_router = APIRouter(prefix="/api/simulate_rethon", tags=["simulate_rethon"])

# /quick_score and /score_changes. Not user-initiated — the frontend fires these
# on every edit and once per suggestion card — so they take a much larger
# allowance of their own. See dependencies.rate_limit_scoring for what sharing
# one bucket cost.
scoring_router = APIRouter(prefix="/api/simulate_rethon", tags=["simulate_rethon"])

T = TypeVar("T")

# How often a running computation checks whether its caller is still there.
_DISCONNECT_POLL_SECONDS = 0.25


async def _watch_for_disconnect(
    http_request: Request, stop: asyncio.Event, finished: asyncio.Event
) -> None:
    """Set ``stop`` if the caller leaves before ``finished`` is set."""
    while not finished.is_set():
        if await http_request.is_disconnected():
            logger.info("The caller left; stopping its computation.")
            stop.set()
            return
        await asyncio.sleep(_DISCONNECT_POLL_SECONDS)


async def _until_disconnected(
    http_request: Request, start: Callable[[asyncio.Event], Awaitable[T]]
) -> Union[T, Response]:
    """Run ``start(stop)``, setting ``stop`` if the caller goes away first, in
    which case the result is a bare 499 ``Response`` for the handler to return.

    The Stop button aborts its fetch, and closing the tab drops the connection,
    but neither reaches the handler by itself: uvicorn goes on running a handler
    whose client has left, so without this the computation would run to its end
    for nobody — and, with one worker, hold up whoever is next in line.
    ``run_in_pool`` kills the worker when ``stop`` is set.

    Nothing here is cancelled or raised past this function. A debugger breaking
    on uncaught exceptions stops wherever one leaves this code for FastAPI's or
    asyncio's — a cancelled task, a raised HTTPException — and a Stop press is an
    expected outcome, not a fault. So the computation is awaited directly rather
    than in a task, the watcher is only ever told to finish, and the 499 (which
    nobody receives; it is what the access log records) is returned.

    Only for the three endpoints a person starts and waits on. The scoring
    endpoints finish in milliseconds, and killing a worker for one would cost
    the next caller a second of worker start-up.
    """
    stop, finished = asyncio.Event(), asyncio.Event()
    asyncio.ensure_future(_watch_for_disconnect(http_request, stop, finished))
    try:
        return await start(stop)
    except ComputationStopped:
        return Response(status_code=499)
    finally:
        finished.set()


@router.post("/simulate", response_model=SimulatedRethonResponse)
async def simulate_rethon(
    request: SimulateRethonRequest,
    http_request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    sentence_pool_minimum: int = 3,
) -> Union[SimulatedRethonResponse, Response]:
    """Run the RE process to a fixed point and return the translated evolution with Z-scores.

    If ``request.evolution`` is supplied the process is resumed from that
    checkpoint (the saved evolution is reconstructed and the simulation continues
    from where it left off).  Otherwise the simulation starts fresh from the
    element statuses in the request.

    Raises 422 if the sentence pool is too small, too large for this deployment,
    or no argument relations are present.
    """
    # In this process: its refusals are HTTPExceptions, which cannot be pickled
    # back out of a worker.
    built_arguments, lookup_w_negated, n = validate_and_build(
        request.elements,
        request.relations,
        sentence_pool_minimum,
        settings.simulation_max_elements,
    )
    try:
        return await _until_disconnected(
            http_request,
            lambda stop: run_in_pool(
                "simulation",
                simulate_to_fixed_point,
                built_arguments,
                lookup_w_negated,
                n,
                request.elements,
                request.evolution,
                request.local,
                request.weights,
                request.neighbourhood_depth,
                timeout=settings.simulation_timeout,
                stop=stop,
            ),
        )
    except HTTPException:
        raise  # a timeout or a lost worker, already logged by the pool
    except Exception as e:
        logger.error("Simulation failed: %s", e, exc_info=True)
        raise


@stepping_router.post("/step", response_model=SimulatedRethonResponse)
async def simulate_rethon_step(
    request: SimulateRethonStepRequest,
    http_request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    sentence_pool_minimum: int = 3,
) -> Union[SimulatedRethonResponse, Response]:
    """Advance the RE process by exactly one step and return the updated evolution.

    On the first call omit ``request.evolution`` (or pass an empty list) — the
    simulation starts from the element statuses.  On each subsequent call pass
    the ``translated_re_state.evolution`` from the previous response to resume.
    All fields except ``evolution`` must be identical across calls for a given
    stepping session.  Returns 400 if the process has already reached a fixed point.
    """
    # In this process, for the reason given in simulate_rethon.
    built_arguments, lookup_w_negated, n = validate_and_build(
        request.elements,
        request.relations,
        sentence_pool_minimum,
        settings.simulation_max_elements,
    )
    try:
        return await _until_disconnected(
            http_request,
            lambda stop: run_in_pool(
                "simulation",
                simulate_one_step,
                built_arguments,
                lookup_w_negated,
                n,
                request.elements,
                request.evolution,
                request.local,
                request.weights,
                request.neighbourhood_depth,
                timeout=settings.simulation_timeout,
                stop=stop,
            ),
        )
    except SimulationFinished as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Step simulation failed: %s", e, exc_info=True)
        raise


@router.post("/score_per_round", response_model=ScorePerRoundResponse)
async def score_per_round(
    request: ScorePerRoundRequest,
    http_request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> Union[ScorePerRoundResponse, Response]:
    """Compute the equilibrium Z-score for each workflow round from 1 to *request.round*.

    Elements and relations are filtered to those present at each round before
    running the rethon simulation.  Rounds where the simulation fails (e.g. not
    enough elements or no arguments yet) are returned with ``scores=None``.
    """
    # Checked once against the whole list rather than per round: every round's
    # subset is a filter of it, so nothing downstream can exceed what this
    # admits. The round count is bounded by the schema — this endpoint runs one
    # simulation per round, so it is the one place where two numbers multiply.
    #
    # In this process, not the worker: the refusal is an HTTPException, which
    # cannot be pickled back out of one.
    enforce_element_cap(len(request.elements), settings.simulation_max_elements)

    round_scores = await _until_disconnected(
        http_request,
        lambda stop: run_in_pool(
            "simulation",
            compute_score_per_round,
            request.elements,
            request.relations,
            request.round,
            request.local,
            request.weights,
            timeout=settings.simulation_timeout,
            stop=stop,
        ),
    )
    if isinstance(round_scores, Response):
        return round_scores  # the caller left
    return ScorePerRoundResponse(round_scores=round_scores)


@scoring_router.post("/score_changes", response_model=ScoreChangesResponse)
async def score_changes(
    request: ScoreChangesRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> ScoreChangesResponse:
    """Batch-compute withdrawal Z-score deltas for all active/revised elements.

    Uses an analytical approach: judgment elements form the commitment position
    (C) and principle/theory elements form the theory position (T).  Z is
    computed directly from ``re_obj.achievement(C, T, C₀)`` — no full RE
    simulation is run.
    """
    # Here as well as inside compute_score_changes: raised in the worker, the
    # HTTPException would fail to unpickle and surface as a 500. Checked here
    # first, the worker's own check can never fire.
    enforce_element_cap(len(request.elements), settings.simulation_max_elements)
    return await run_in_pool(
        "scoring",
        compute_score_changes,
        request.elements,
        request.relations,
        request.local,
        request.weights,
        settings.simulation_max_elements,
        timeout=settings.simulation_timeout,
    )


@scoring_router.post("/quick_score", response_model=QuickScoreResponse)
async def quick_score(
    request: QuickScoreRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> QuickScoreResponse:
    """Compute account and systematicity for the current element set analytically.

    Derives C (all active/revised/rejected elements) and T (active/revised
    principle/theory elements) directly from element types — no simulation or
    prior evolution is required.

    Returns ``account=null, systematicity=null`` when there are fewer than 3
    elements, no argument relations, or no active principle/theory elements.
    """
    # In this process first, for the reason given in score_changes.
    enforce_element_cap(len(request.elements), settings.simulation_max_elements)
    return await run_in_pool(
        "scoring",
        compute_quick_score,
        request.elements,
        request.relations,
        request.weights,
        settings.simulation_max_elements,
        timeout=settings.simulation_timeout,
    )
