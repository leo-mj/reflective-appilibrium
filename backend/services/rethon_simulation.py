"""Core RE simulation service — builds dialectical structures, runs RE processes, and translates results."""

from fastapi import HTTPException
from typing import List, Dict, Optional, Union
from collections import defaultdict
import logging
import time

from theodias import Position, StandardPosition, BDDDialecticalStructure
from rethon import (
    StandardLocalReflectiveEquilibrium,
    StandardGlobalReflectiveEquilibrium,
    REState,
)
from ..models.re_state import REElement, RERelation
from ..routers.arguments_schemas import DetectArgumentsResponse, translate_from_lookup
from ..routers.rethon_schemas import (
    ModelWeights,
    ZScores,
    SimulatedRethonResponse,
    SimulatedRethonState,
)

logger = logging.getLogger(__name__)

REProcess = Union[
    StandardLocalReflectiveEquilibrium, StandardGlobalReflectiveEquilibrium
]


def build_numerical_arguments(
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


def get_rethon_final_state(
    numerical_arguments: List[List[int]],
    n_unnegated_sentence_pool: int,
    lookup: Dict[int, REElement],
    local: bool = True,
    weights: Optional[ModelWeights] = None,
    neighbourhood_depth: Optional[int] = 1,
) -> REProcess:
    """Build a BDD dialectical structure, set initial commitments from the lookup, and run the full RE process to a fixed point.

    Uses ``StandardLocalReflectiveEquilibrium`` when ``local=True`` (considers
    only positions close to the current one) or
    ``StandardGlobalReflectiveEquilibrium`` otherwise (considers all positions;
    slow for sentence pools larger than ~10 elements).
    """
    logger.info("Beginning rethon simulation.")
    start = time.time()
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
    re.set_model_parameters(neighbourhood_depth=neighbourhood_depth)
    re.re_process()
    end = time.time()
    logger.info(f"Completed rethon simulation in {end - start:.2f} seconds'")
    return re


def build_re(
    numerical_arguments: List[List[int]],
    n_unnegated_sentence_pool: int,
    init_coms: Position,
    local: bool = True,
    weights: Optional[ModelWeights] = None,
    neighbourhood_depth: Optional[int] = 1,
) -> REProcess:
    """Build and initialise a rethon RE object without running any steps."""
    bdd_ds = BDDDialecticalStructure.from_arguments(
        arguments=numerical_arguments,
        n_unnegated_sentence_pool=n_unnegated_sentence_pool,
    )
    if local:
        re: REProcess = StandardLocalReflectiveEquilibrium(
            dialectical_structure=bdd_ds, initial_commitments=init_coms
        )
    else:
        re = StandardGlobalReflectiveEquilibrium(
            dialectical_structure=bdd_ds, initial_commitments=init_coms
        )
    if weights is not None:
        re.set_model_parameters({"weights": weights.model_dump()})

    re.set_model_parameters(neighbourhood_depth=neighbourhood_depth)
    return re


def reconstruct_re_state(
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


def compute_evolution_scores(re: REProcess) -> List[Optional[ZScores]]:
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


def get_final_score(
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
        built, _, n = validate_and_build(elements, relations, sentence_pool_minimum=3)
        re = get_rethon_final_state(
            numerical_arguments=built.num_arguments,
            n_unnegated_sentence_pool=n,
            lookup=built.lookup,
            local=local,
            weights=weights,
        )
        scores_list = compute_evolution_scores(re)
        return next((s for s in reversed(scores_list) if s is not None), None)
    except Exception:
        return None


def translate_re_state(
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


def enforce_element_cap(n: int, max_elements: int) -> None:
    """Refuse a sentence pool too large to compute over, or return quietly.

    ``max_elements`` of 0 means unlimited, which is how a local install opts out.

    Every rethon computation here builds a BDD whose size grows exponentially in
    the sentence pool, so this is a wall-clock guard, not a fairness one: past
    some width a single request stops being slow and starts being one that never
    returns, taking the worker with it. 422 rather than 413, because the payload
    is well-formed and the right size for a different deployment — it is this
    server that cannot answer it.

    Called by every entry point that builds a structure, including the two in
    ``rethon_scoring`` that build their own rather than going through
    ``validate_and_build``.
    """
    if max_elements and n > max_elements:
        raise HTTPException(
            status_code=422,
            detail=(
                f"This instance computes over at most {max_elements} elements; "
                f"the request has {n}. Run the backend locally to lift the cap."
            ),
        )


def validate_and_build(
    elements: List[REElement],
    relations: List[RERelation],
    sentence_pool_minimum: int = 3,
    max_elements: int = 0,
) -> tuple[DetectArgumentsResponse, Dict[int, REElement], int]:
    """Validate the request payload and build the numerical argument structures.

    Raises HTTPException on invalid input.  Returns the built arguments, the
    negated lookup, and the sentence pool size.

    ``max_elements`` is passed in rather than read from settings so this stays a
    pure function of its arguments — which is what lets it be called from a
    worker process without carrying configuration across the pipe.
    """
    n = len(elements)
    enforce_element_cap(n, max_elements)
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
    built_arguments = build_numerical_arguments(
        elements=elements, relations=arg_relations
    )
    lookup_w_negated = _add_negated_to_lookup(lookup=built_arguments.lookup)
    return built_arguments, lookup_w_negated, n


# ── Worker entry points ───────────────────────────────────────────────────────
#
# /simulate and /step run these in the simulation pool (see process_pool.py).
# Each takes what validate_and_build returned in the parent, so no check that
# can refuse a request runs here, and each returns the finished response rather
# than the REProcess: that object does pickle, but it carries the whole BDD
# manager, which would be serialised across the pipe only to be thrown away.


class SimulationFinished(Exception):
    """A step was asked of a process that has already reached its fixed point.

    Raised in a worker in place of an ``HTTPException``, which cannot be
    unpickled; the router turns it back into a 400.
    """


def _index_by_id(elements: List[REElement]) -> Dict[str, int]:
    return {el.id: i + 1 for i, el in enumerate(elements)}


def _respond(
    re: REProcess,
    built_arguments: DetectArgumentsResponse,
    lookup_w_negated: Dict[int, REElement],
) -> SimulatedRethonResponse:
    scores = compute_evolution_scores(re)
    return SimulatedRethonResponse(
        translated_arguments=built_arguments.translated_arguments,
        translated_re_state=translate_re_state(re.state(), lookup_w_negated, scores),
    )


def simulate_to_fixed_point(
    built_arguments: DetectArgumentsResponse,
    lookup_w_negated: Dict[int, REElement],
    n: int,
    elements: List[REElement],
    evolution: Optional[List[List[REElement]]],
    local: bool = True,
    weights: Optional[ModelWeights] = None,
    neighbourhood_depth: int = 1,
) -> SimulatedRethonResponse:
    """Run the RE process to a fixed point, resuming from ``evolution`` if given."""
    if evolution:
        reconstructed = reconstruct_re_state(evolution, _index_by_id(elements), n)
        re = build_re(
            built_arguments.num_arguments,
            n,
            reconstructed.initial_commitments(),
            local,
            weights,
            neighbourhood_depth,
        )
        re.set_state(reconstructed)
        re.re_process()
    else:
        re = get_rethon_final_state(
            numerical_arguments=built_arguments.num_arguments,
            n_unnegated_sentence_pool=n,
            lookup=built_arguments.lookup,
            local=local,
            weights=weights,
            neighbourhood_depth=neighbourhood_depth,
        )
    return _respond(re, built_arguments, lookup_w_negated)


def simulate_one_step(
    built_arguments: DetectArgumentsResponse,
    lookup_w_negated: Dict[int, REElement],
    n: int,
    elements: List[REElement],
    evolution: Optional[List[List[REElement]]],
    local: bool = True,
    weights: Optional[ModelWeights] = None,
    neighbourhood_depth: int = 1,
) -> SimulatedRethonResponse:
    """Advance the RE process by one step from ``evolution``, or from the element
    statuses when there is none.

    Raises ``SimulationFinished`` if the process is already at a fixed point.
    """
    id_to_index = _index_by_id(elements)
    if evolution:
        reconstructed = reconstruct_re_state(evolution, id_to_index, n)
        init_coms = reconstructed.initial_commitments()
    else:
        init_coms = StandardPosition.from_set(
            position={
                (
                    id_to_index[el.id]
                    if el.status in ("active", "revised")
                    else -id_to_index[el.id]
                )
                for el in elements
                if el.status in ("active", "revised", "rejected")
            },
            n_unnegated_sentence_pool=n,
        )
    re = build_re(
        numerical_arguments=built_arguments.num_arguments,
        n_unnegated_sentence_pool=n,
        init_coms=init_coms,
        local=local,
        weights=weights,
        neighbourhood_depth=neighbourhood_depth,
    )
    if evolution:
        re.set_state(reconstructed)
    if re.state().finished:
        raise SimulationFinished("The RE process has already reached a fixed point.")
    re.next_step()
    return _respond(re, built_arguments, lookup_w_negated)
