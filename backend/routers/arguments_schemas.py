"""Pydantic request/response models and translation utility for the arguments router."""

from typing import List, Dict
from pydantic import BaseModel

from ..models.re_state import REElement, RERelation


class DetectArgumentsRequest(BaseModel):
    """Payload for ``POST /api/arguments/detect``."""

    elements: List[REElement]
    relations: List[RERelation] = []
    round: str


class LLMArgumentsResponse(BaseModel):
    """Raw argument data returned by the LLM, before deduplication and translation."""

    detected_arguments: List[List[int]]
    added_premises: List[Dict]
    input_tokens: int
    output_tokens: int


class DetectArgumentsResponse(BaseModel):
    """Detected arguments in numeric and translated form, plus the element lookup.

    ``num_arguments`` uses integer indices (negative = negated); ``translated_arguments``
    is the parallel list with each index replaced by its REElement.  ``lookup`` maps
    every integer index (positive and negative) to an REElement so callers can perform
    further translations without re-requesting.
    """

    num_arguments: List[List[int]]
    translated_arguments: List[List[REElement]] = []
    lookup: Dict
    input_tokens: int = 0
    output_tokens: int = 0


def translate_from_lookup(
    nums: List[int], lookup: Dict[int, REElement]
) -> List[REElement]:
    """Translate a numeric argument list into REElements using the lookup.

    Positive indices map directly; negative indices produce a negated copy of
    the corresponding positive-index element (``negated=True``).
    """
    result = []
    for num in nums:
        if num in lookup:
            result.append(lookup[num])
        else:
            result.append(lookup[abs(num)].model_copy(update={"negated": True}))
    return result
