from fastapi import APIRouter, Depends
from typing import List, Set, Tuple, Dict, Iterator, Any, Union, Annotated
from ..services.llm import LLMService
from ..dependencies import get_llm_service
from pydantic import BaseModel
import json

from theodias import StandardPosition, BDDDialecticalStructure 
from rethon import StandardLocalReflectiveEquilibrium, REState
from ..models.re_state import REElement
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/simulate_rethon", tags=["simulate_rethon"])

class DetectArgumentsResponse(BaseModel):
    num_arguments: List[List[int]]
    input_tokens: int
    output_tokens: int


class SimulatedRethonState(BaseModel):
    """A ."""

    finished: bool
    evolution: List[List[REElement]]
    alternatives: List[List[REElement]]

class SimulatedRethonResponse(BaseModel):
    """Response from ``POST /api/relations/suggest``."""

    translated_arguments: list[List[REElement]]
    translated_re_state: SimulatedRethonState
    model: str
    input_tokens: int = 0
    output_tokens: int = 0

def _build_prompt( sentence_dict: Dict[int, REElement]) -> str:
    """Build the LLM prompt for principle suggestion.

    Both active judgments and existing principles are included so the model
    can avoid redundant proposals and estimate how many new principles are
    warranted (target: roughly one per three elements).
    """
    element_lines = (
        "\n".join(f"  {element_num}: {element.text}" for element_num, element in sentence_dict.items())
    )

    return f"""\
You are an expert in philosophical logic, semantics, and linguistics.

Existing sentences to map into arguments:
{element_lines}
Each key-value pair consists of the sentence (value) and its numerical representation (key) as a sentence in propositional logic.

Task: List all of the possible logically valid arguments that can be formed with the sentences. 
Each argument in the list is itself a list, in which the final member is the conclusion and all previous members are the premises.
In the lists, the sentences are just represented through their key.
For example, in [3, 4, 7], 7 is the conclusion and [3, 4] are the premises.

Respond with valid JSON only, in exactly this format:
{{
  "arguments": [
        [1, 5],
        [3, 4, 7],
        [1, 3, 6],
        ...
  ]
}}
."""


async def detect_arguments(sentence_dict: Dict[int, REElement], n_unnegated_sentence_pool: int, llm: Annotated[LLMService, Depends(get_llm_service)], ) -> DetectArgumentsResponse:
    logger.info(
    f"Requesting detected arguments from model '{llm.model}' for {n_unnegated_sentence_pool} elements"
    )
    prompt = _build_prompt(sentence_dict)
    result = await llm.complete_with_usage(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        json_mode=True,
    )
    data = json.loads(result.text)
    detected_arguments = data.get("arguments", [])
    logger.info(f"Received {len(detected_arguments)} arguments from LLM.")    
    return DetectArgumentsResponse(
        num_arguments=detected_arguments,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )


def get_rethon_final_state_local(detected_arguments: List[List[int]], n_unnegated_sentence_pool: int, sentence_dict: Dict[int, REElement]) -> REState:
    logger.info("Beginning rethon simulation with detected arguments.")
    bdd_ds = BDDDialecticalStructure.from_arguments(arguments=detected_arguments, n_unnegated_sentence_pool=n_unnegated_sentence_pool)
    initial_position = set([
        index for index, element in sentence_dict.items() if element.status == "active"
    ])
    init_coms = StandardPosition.from_set(position=initial_position, n_unnegated_sentence_pool=n_unnegated_sentence_pool)
    local_re = StandardLocalReflectiveEquilibrium(bdd_ds, init_coms)
    local_re.set_initial_state(init_coms)
    local_re.re_process()
    logger.info("Completed rethon simulation.")
    return local_re.state()

def _translate(nums: List[int], sentence_dict: Dict[int, REElement]) -> List[REElement]:
    return [sentence_dict[num] for num in nums]


def _translate_arguments(detected_arguments: List[List[int]], sentence_dict: Dict[int, REElement]) -> List[List[REElement]]:
    logger.info("Translating arguments.")
    result = [_translate(arg, sentence_dict) for arg in detected_arguments]
    logger.info("Completed translating arguments.")
    return result


def _translate_re_state(numerical_re_state: REState, sentence_dict: Dict[int, REElement]) -> SimulatedRethonState:
    """
    re_state_dict looks like this:
    {
        'alternatives': [set(), {{2}}, set(), set(), set(), set()],
        'evolution': [
            {1, 2, 5},
            {1},
            {1, 3, 4, 5, -6, -2},
            {1},
            {1, 3, 4, 5, -6, -2},
            {1}
        ],
        'finished': True,
        'time_line': [0, 1, 2, 3, 4, 5]
    }
    """
    logger.info("Translating rethon RE state.")
    re_state_dict = numerical_re_state.as_dict()
    result = SimulatedRethonState(
        finished=re_state_dict["finished"],
        evolution=[_translate(pos.as_list(), sentence_dict) for pos in re_state_dict["evolution"]], # Position objects
        alternatives=[_translate(alt.as_list(), sentence_dict) for alt_set in re_state_dict["alternatives"] for alt in alt_set], # Sets of Position objects
    )
    logger.info("Completed translating rethon RE state.")
    return result


# Dummy arguments keyed to the dummy RE state (obligations to future generations).
# Active element order after filtering withdrawn/rejected:
# 1:J1 2:J2 3:J3 4:J4 5:J5 6:J7 7:J8 8:J9 9:J10 10:J12
# 11:P1 12:P2 13:P3 14:P5 15:P6 16:T1 17:T2
_DUMMY_ARGUMENTS: List[List[int]] = [
    [11, 1],        # P1 → J1 (sufficientarian threshold → radioactive waste)
    [11, 2],        # P1 → J2 (sufficientarian → climate policy)
    [11, 3],        # P1 → J3 (sufficientarian → resource depletion)
    [11, 4],        # P1 → J4 (sufficientarian → liveable environment)
    [12, 7],        # P2 → J8 (probabilistic obligation → extinction prevention)
    [12, 5],        # P2 → J5 (probabilistic obligation → uncertainty discounting)
    [13, 9],        # P3 → J10 (uncertainty not temporal → equal counting)
    [14, 2],        # P5 → J2 (Rawlsian extension → climate policy)
    [14, 10],       # P5 → J12 (Rawlsian → democratic institutions)
    [14, 9],        # P5 → J10 (Rawlsian → equal counting)
    [15, 6],        # P6 → J7 (proximity modulates → parental obligations)
    [16, 14],       # T1 → P5 (well-being capacity sufficient → Rawlsian valid)
    [16, 12],       # T1 → P2 (identity not required → probabilistic obligation)
    [17, 12],       # T2 → P2 (class determinacy → probabilistic obligation)
    [16, 17, 12],   # T1 + T2 → P2 (conjunction)
    [11, 14, 9],    # P1 + P5 → J10 (sufficientarian + Rawlsian → equal counting)
    [12, 13, 5],    # P2 + P3 → J5 (probabilistic + uncertainty threshold → discounting)
]


def _dummy_detect_arguments(n_unnegated_sentence_pool: int) -> DetectArgumentsResponse:
    valid = [arg for arg in _DUMMY_ARGUMENTS if all(n <= n_unnegated_sentence_pool for n in arg)]
    return DetectArgumentsResponse(num_arguments=valid, input_tokens=0, output_tokens=0)


@router.post("/simulate", response_model=SimulatedRethonResponse)
async def simulate_rethon(elements: List[REElement], llm: Annotated[LLMService, Depends(get_llm_service)], sentence_pool_minimum: int = 3, use_dummy: bool = False) -> SimulatedRethonResponse:
    n_unnegated_sentence_pool = len(elements)
    if n_unnegated_sentence_pool < sentence_pool_minimum:
        raise ValueError(f"There are fewer than {sentence_pool_minimum} elements forming the sentence pool.")
    sentence_dict = {index + 1: e for index, e in enumerate(elements)}
    lookup = {**sentence_dict, **{-k: e.model_copy(update={"negated": True}) for k, e in sentence_dict.items()}}
    if use_dummy:
        detected_arguments_response = _dummy_detect_arguments(n_unnegated_sentence_pool)
    else:
        detected_arguments_response = await detect_arguments(sentence_dict=sentence_dict, n_unnegated_sentence_pool=n_unnegated_sentence_pool, llm=llm)
    try:
        translated_arguments = _translate_arguments(detected_arguments=detected_arguments_response.num_arguments, sentence_dict=lookup)
        numerical_re_state = get_rethon_final_state_local(detected_arguments=detected_arguments_response.num_arguments, n_unnegated_sentence_pool=n_unnegated_sentence_pool, sentence_dict=sentence_dict)
        translated_re_state = _translate_re_state(numerical_re_state=numerical_re_state, sentence_dict=lookup)
    except Exception as e:
        logger.error(f"Simulation failed: {e}", exc_info=True)
        raise
    logger.info("Returning response with rethon RE state.")
    return SimulatedRethonResponse(
        translated_arguments=translated_arguments,
        translated_re_state=translated_re_state,
        model=llm.model,
        input_tokens=detected_arguments_response.input_tokens,
        output_tokens=detected_arguments_response.output_tokens
    )
