from fastapi import APIRouter, HTTPException
from typing import List, Dict
from collections import defaultdict
from pydantic import BaseModel, Field
import logging

from theodias import StandardPosition, BDDDialecticalStructure
from rethon import StandardLocalReflectiveEquilibrium, REState
from ..models.re_state import REElement, RERelation
from .arguments import DetectArgumentsResponse, translate_from_lookup

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/simulate_rethon", tags=["simulate_rethon"])


class SimulateRethonRequest(BaseModel):
    """Payload for ``POST /api/simulate_rethon/simulate``."""

    round: str = Field(max_length=500)
    elements: list[REElement] = Field(min_length=1, max_length=200)
    relations: list[RERelation] = Field(default_factory=list, max_length=5_000)


class SimulatedRethonState(BaseModel):
    finished: bool
    evolution: List[List[REElement]]
    alternatives: List[List[REElement]]


class SimulatedRethonResponse(BaseModel):
    """Response from ``POST /api/simulate_rethon/simulate``."""

    translated_arguments: list[List[REElement]]
    translated_re_state: SimulatedRethonState
    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0


def _build_numerical_arguments(
    elements: List[REElement],
    relations: List[RERelation],
) -> DetectArgumentsResponse:
    """Build rethon-compatible lookup and argument lists from frontend relations."""
    lookup: Dict[int, REElement] = {i + 1: el for i, el in enumerate(elements)}
    id_to_index: Dict[str, int] = {el.id: i + 1 for i, el in enumerate(elements)}

    args_by_id: Dict[str, List[RERelation]] = defaultdict(list)
    for rel in relations:
        if rel.type == "jointly_entails" and rel.argument_id:
            args_by_id[rel.argument_id].append(rel)

    numerical_arguments: List[List[int]] = []
    for arg_rels in args_by_id.values():
        conclusion_idx = id_to_index.get(arg_rels[0].to_id)
        premise_indices = [id_to_index.get(rel.from_id) for rel in arg_rels]
        if conclusion_idx is None or any(idx is None for idx in premise_indices):
            logger.warning("Skipping argument with unknown element IDs.")
            continue
        numerical_arguments.append([idx for idx in premise_indices if idx is not None] + [conclusion_idx])

    translated_arguments = [translate_from_lookup(arg, lookup) for arg in numerical_arguments]
    return DetectArgumentsResponse(
        num_arguments=numerical_arguments,
        translated_arguments=translated_arguments,
        lookup=lookup
    )


def _add_negated_to_lookup(lookup: Dict) -> Dict:
    return {**lookup, **{-k: e.model_copy(update={"negated": True}) for k, e in lookup.items()}}


def _get_rethon_final_state(
    numerical_arguments: List[List[int]],
    n_unnegated_sentence_pool: int,
    lookup: Dict[int, REElement],
) -> REState:
    logger.info("Beginning rethon simulation.")
    bdd_ds = BDDDialecticalStructure.from_arguments(
        arguments=numerical_arguments,
        n_unnegated_sentence_pool=n_unnegated_sentence_pool,
    )
    initial_position = {index for index, element in lookup.items() if element.status == "active"}
    init_coms = StandardPosition.from_set(
        position=initial_position,
        n_unnegated_sentence_pool=n_unnegated_sentence_pool,
    )
    local_re = StandardLocalReflectiveEquilibrium(bdd_ds, init_coms)
    local_re.set_initial_state(init_coms)
    local_re.re_process()
    logger.info("Completed rethon simulation.")
    return local_re.state()


def _translate_re_state(numerical_re_state: REState, lookup: Dict[int, REElement]) -> SimulatedRethonState:
    logger.info("Translating rethon RE state.")
    re_state_dict = numerical_re_state.as_dict()
    result = SimulatedRethonState(
        finished=re_state_dict["finished"],
        evolution=[translate_from_lookup(pos.as_list(), lookup) for pos in re_state_dict["evolution"]],
        alternatives=[
            translate_from_lookup(alt.as_list(), lookup)
            for alt_set in re_state_dict["alternatives"]
            for alt in alt_set
        ],
    )
    logger.info("Completed translating rethon RE state.")
    return result


@router.post("/simulate", response_model=SimulatedRethonResponse)
async def simulate_rethon(
    request: SimulateRethonRequest,
    sentence_pool_minimum: int = 3,
) -> SimulatedRethonResponse:
    if len(request.elements) < sentence_pool_minimum:
        raise HTTPException(
            status_code=422,
            detail=f"There are fewer than {sentence_pool_minimum} elements forming the sentence pool.",
        )

    jointly_entails = [r for r in request.relations if r.type == "jointly_entails"]
    if not jointly_entails:
        raise HTTPException(
            status_code=422,
            detail="No jointly_entails relations found. Accept arguments in the Detect Arguments tab first.",
        )

    built_arguments = _build_numerical_arguments(
        elements=request.elements,
        relations=jointly_entails,
    )

    try:
        n_unnegated_sentence_pool = len(request.elements)
        numerical_re_state = _get_rethon_final_state(
            numerical_arguments=built_arguments.num_arguments,
            n_unnegated_sentence_pool=n_unnegated_sentence_pool,
            lookup=built_arguments.lookup,
        )
        lookup_w_negated = _add_negated_to_lookup(lookup=built_arguments.lookup)
        translated_re_state = _translate_re_state(
            numerical_re_state=numerical_re_state,
            lookup=lookup_w_negated,
        )
    except Exception as e:
        logger.error(f"Simulation failed: {e}", exc_info=True)
        raise

    logger.info("Returning rethon simulation response.")
    return SimulatedRethonResponse(
        translated_arguments=built_arguments.translated_arguments,
        translated_re_state=translated_re_state,
    )
