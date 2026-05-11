from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Tuple, Set, Annotated
from ..services.llm import LLMService
from ..dependencies import get_llm_service
from pydantic import BaseModel
import json

from ..models.re_state import REElement, RERelation
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/arguments", tags=["arguments"])

class DetectArgumentsRequest(BaseModel):
    elements: List[REElement]
    relations: List[RERelation] = []
    round: str

class LLMArgumentsResponse(BaseModel):
    detected_arguments: List[List[int]]
    added_premises: List[Dict]
    input_tokens: int
    output_tokens: int

class DetectArgumentsResponse(BaseModel):
    num_arguments: List[List[int]]
    translated_arguments: List[List[REElement]] = []
    lookup: Dict
    input_tokens: int = 0
    output_tokens: int = 0


def translate_from_lookup(nums: List[int], lookup: Dict[int, REElement]) -> List[REElement]:
    return [lookup[num] for num in nums]


def _arg_fingerprint(arg: List[int]) -> Tuple:
    return (tuple(sorted(arg[:-1])), arg[-1])


def _existing_arg_fingerprints(relations: List[RERelation], reverse_lookup: Dict[str, int]) -> Set[Tuple]:
    groups: Dict[str, Dict] = {}
    for r in relations:
        if r.type != "jointly_entails" or not r.argument_id:
            continue
        if r.argument_id not in groups:
            groups[r.argument_id] = {"froms": [], "to": r.to_id}
        groups[r.argument_id]["froms"].append(r.from_id)

    fingerprints: Set[Tuple] = set()
    for group in groups.values():
        premise_indices = [reverse_lookup[eid] for eid in group["froms"] if eid in reverse_lookup]
        conclusion_index = reverse_lookup.get(group["to"])
        if conclusion_index is not None and len(premise_indices) == len(group["froms"]):
            fingerprints.add(_arg_fingerprint(sorted(premise_indices) + [conclusion_index]))
    return fingerprints


def _filter_existing_arguments(num_arguments: List[List[int]], relations: List[RERelation], lookup: Dict[int, REElement]) -> List[List[int]]:
    reverse_lookup = {e.id: n for n, e in lookup.items()}
    existing = _existing_arg_fingerprints(relations, reverse_lookup)
    filtered = [arg for arg in num_arguments if _arg_fingerprint(arg) not in existing]
    removed = len(num_arguments) - len(filtered)
    if removed:
        logger.info(f"Filtered out {removed} argument(s) already present in the state.")
    return filtered


def _format_existing_args_for_prompt(relations: List[RERelation], reverse_lookup: Dict[str, int]) -> str:
    groups: Dict[str, Dict] = {}
    for r in relations:
        if r.type != "jointly_entails" or not r.argument_id:
            continue
        if r.argument_id not in groups:
            groups[r.argument_id] = {"froms": [], "to": r.to_id}
        groups[r.argument_id]["froms"].append(r.from_id)

    lines = []
    for group in groups.values():
        premise_indices = [reverse_lookup[eid] for eid in group["froms"] if eid in reverse_lookup]
        conclusion_index = reverse_lookup.get(group["to"])
        if conclusion_index is not None and len(premise_indices) == len(group["froms"]):
            arg = sorted(premise_indices) + [conclusion_index]
            premise_ids = ", ".join(group["froms"])
            lines.append(f"  {arg}  ({premise_ids} → {group['to']})")
    return "\n".join(lines)


def _build_prompt(lookup: Dict[int, REElement], relations: List[RERelation] = []) -> str:
    element_lines = "\n".join(f"  {n}: {e.text}" for n, e in lookup.items())

    reverse_lookup = {e.id: n for n, e in lookup.items()}
    existing_str = _format_existing_args_for_prompt(relations, reverse_lookup)
    existing_section = (
        f"\nAlready accepted arguments — do not reproduce these:\n{existing_str}\n"
        if existing_str else ""
    )

    return f"""\
You are an expert in philosophical logic, semantics, and linguistics.

Sentences to map into arguments:
{element_lines}
Each key-value pair consists of the sentence (value) and its numerical representation (key) as a sentence in propositional logic.
{existing_section}
Task:
List all of the possible strictly logically valid arguments that can be formed with the sentences.
If there are arguments with a suppressed premise, add the premise as a dictionary with a unique integer index, the content of the premise, and its type.
The type can take the value "judgment", "principle", or "theory" if it is a background theory.
Output: Each argument in the list is itself a list, in which the final member is the conclusion and all previous members are the premises.
In the lists, the sentences are just represented through their key.
For example, in [3, 4, 7], 7 is the conclusion and [3, 4] are the premises.

Respond with valid JSON only, in exactly this format:
{{
  "arguments": [
        [1, 5],
        [3, 4, 7],
        [1, 3, 6],
        ...
  ],
  "added_premises": [
    {{
      "index": 7,
      "type": "judgment",
      "text": "..."
    }},
  ]
}}
."""

def _add_new_premises_to_lookup(lookup: Dict[int, REElement], added_premises: List[Dict], elements: List[REElement], round: str, model: str) -> Dict:
    if not added_premises:
        logger.info("No new premises to add to lookup.")
        return lookup
    logger.info(f"Adding {len(added_premises)} to lookup.")
    updated_lookup = {**lookup}
    max_ids_dict = {
        "J": len([e for e in elements if e.type == "judgment"]),
        "P": len([e for e in elements if e.type == "principle"]),
        "T": len([e for e in elements if e.type == "theory"])
    }

    for premise in added_premises:
        id_type = premise["type"][0].upper()
        id_int = max_ids_dict[id_type] + 1
        new_element = REElement(
            id = id_type + str(id_int),
            text = premise["text"],
            type=premise["type"],
            addedRound=int(round) + 1,
            status="active",
            confidence="moderate",
            origin=model,
            previousText=None,
            reason=None,
            withdrawnRound=None,
            rejectedRound=None,
            revisedRound=None
        )
        updated_lookup[premise["index"]] = new_element
        max_ids_dict[id_type] += 1
    logger.info("Completed adding premises to lookup.")
    return updated_lookup


def _translate_arguments(detected_arguments: List[List[int]], lookup: Dict[int, REElement]) -> List[List[REElement]]:
    logger.info("Translating arguments.")
    result = [translate_from_lookup(arg, lookup) for arg in detected_arguments]
    logger.info("Completed translating arguments.")
    return result


# Dummy arguments keyed to the dummy RE state (obligations to future generations).
# Full element order (all 20, including withdrawn):
# 1:J1  2:J2  3:J3  4:J4  5:J5  6:J6(w)  7:J7  8:J8  9:J9  10:J10  11:J11(w)  12:J12
# 13:P1  14:P2  15:P3  16:P4(w)  17:P5  18:P6  19:T1  20:T2
_DUMMY_ARGUMENTS: List[List[int]] = [
    # Suppressed-premise arguments (indices 21–23 added by _dummy_detect_arguments):
    # 21:J (radioactive waste leaves future generations worse off — bridge for P1→J1)
    # 22:P (well-being capacity grounds justice obligations — bridge for T1→P5)
    # 23:J (people in 2100 are causally affected by today's climate policy — bridge for P5→J2)
    [13, 21, 1],    # P1 + J21 → J1 (sufficientarian + factual bridge → radioactive waste wrong)
    [13, 3],        # P1 → J3 (sufficientarian → resource depletion)
    [13, 4],        # P1 → J4 (sufficientarian → liveable environment)
    [14, 8],        # P2 → J8 (probabilistic obligation → extinction prevention)
    [14, 5],        # P2 → J5 (probabilistic obligation → uncertainty discounting)
    [15, 10],       # P3 → J10 (uncertainty not temporal → equal counting)
    [17, 23, 2],    # P5 + J23 → J2 (Rawlsian + causal bridge → climate policy)
    [17, 12],       # P5 → J12 (Rawlsian → democratic institutions)
    [17, 10],       # P5 → J10 (Rawlsian → equal counting)
    [18, 7],        # P6 → J7 (proximity modulates → parental obligations)
    [19, 22, 17],   # T1 + P22 → P5 (well-being capacity + justice bridge → Rawlsian valid)
    [19, 14],       # T1 → P2 (identity not required → probabilistic obligation)
    [20, 14],       # T2 → P2 (class determinacy → probabilistic obligation)
    [19, 20, 14],   # T1 + T2 → P2 (conjunction)
    [13, 17, 10],   # P1 + P5 → J10 (sufficientarian + Rawlsian → equal counting)
    [14, 15, 5],    # P2 + P3 → J5 (probabilistic + uncertainty threshold → discounting)
]


def _dummy_detect_arguments(n_unnegated_sentence_pool: int, elements: List[REElement], round: str) -> DetectArgumentsResponse:
    initial_lookup = {index + 1: e for index, e in enumerate(elements)}
    added_premises = [
        {
            "index": 21,
            "type": "judgment",
            "text": "Burying large quantities of radioactive waste without containment, knowing it will poison groundwater for millennia, constitutes leaving future generations materially worse off than we found things.",
        },
        {
            "index": 22,
            "type": "principle",
            "text": "Beings who possess or will possess the capacity for well-being and who will be affected by our decisions are owed obligations of justice.",
        },
        {
            "index": 23,
            "type": "judgment",
            "text": "People living in 2100 and beyond will be causally affected by climate policies adopted today.",
        },
    ]
    pool_size = n_unnegated_sentence_pool + len(added_premises)
    num_arguments = [arg for arg in _DUMMY_ARGUMENTS if all(n <= pool_size for n in arg)]
    lookup_w_premises = _add_new_premises_to_lookup(
        added_premises=added_premises,
        lookup=initial_lookup,
        elements=elements,
        round=round,
        model="dummy",
    )
    translated_arguments = _translate_arguments(detected_arguments=num_arguments, lookup=lookup_w_premises)
    return DetectArgumentsResponse(
        num_arguments=num_arguments,
        translated_arguments=translated_arguments,
        lookup=lookup_w_premises
    )


async def _get_arguments_from_llm(
    lookup: Dict[int, REElement], llm: LLMService, relations: List[RERelation] = []
) -> LLMArgumentsResponse:
    prompt = _build_prompt(lookup, relations)
    result = await llm.complete_with_usage(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        json_mode=True,
    )
    data = json.loads(result.text)
    return LLMArgumentsResponse(
        detected_arguments = data.get("arguments", []),
        added_premises = data.get("added_premises", []),
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens
    )


@router.post("/detect", response_model=DetectArgumentsResponse)
async def detect_arguments(
    request: DetectArgumentsRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
    use_dummy: bool = False,
    sentence_pool_minimum: int = 3, 
) -> DetectArgumentsResponse:
    n_unnegated_sentence_pool = len(request.elements)
    if n_unnegated_sentence_pool < sentence_pool_minimum:
        raise HTTPException(status_code=422, detail=f"There are fewer than {sentence_pool_minimum} elements forming the sentence pool.")
    try:
        if use_dummy:
            logger.info("Returning dummy arguments")
            detected_arguments_response = _dummy_detect_arguments(
                n_unnegated_sentence_pool=n_unnegated_sentence_pool, elements=request.elements, round=request.round
            )
            return detected_arguments_response
        
        logger.info(
            f"Requesting detected arguments from model '{llm.model}' for {n_unnegated_sentence_pool} elements"
        )
        initial_lookup = {index + 1: e for index, e in enumerate(request.elements)}
        llm_response = await _get_arguments_from_llm(llm=llm, lookup=initial_lookup, relations=request.relations)
        logger.info(f"Received {len(llm_response.detected_arguments)} arguments from LLM.")

        lookup_w_premises = _add_new_premises_to_lookup(
            lookup=initial_lookup, added_premises=llm_response.added_premises, elements=request.elements, round=request.round, model=llm.model
        )
        filtered_arguments = _filter_existing_arguments(llm_response.detected_arguments, request.relations, lookup_w_premises)
        translated_arguments = _translate_arguments(detected_arguments=filtered_arguments, lookup=lookup_w_premises)

        return DetectArgumentsResponse(
            num_arguments=filtered_arguments,
            translated_arguments=translated_arguments,
            lookup=lookup_w_premises,
            input_tokens=llm_response.input_tokens,
            output_tokens=llm_response.output_tokens,
        )
    
    except Exception as e:
        logger.error(f"Detecing arguments failed: {e}", exc_info=True)
        raise
