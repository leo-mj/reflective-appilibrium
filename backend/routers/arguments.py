"""
Arguments router — /api/arguments

Maps active RE elements into a propositional sentence lookup (integer → REElement),
asks the LLM to enumerate all strictly logically valid arguments that can be formed
over that pool, deduplicates against arguments already in the state, and returns
both the numeric argument lists and their element-translated forms.

Negative indices in argument lists represent negations: ``-n`` means ¬sentence n.
The final member of each inner list is the conclusion; all preceding members are premises.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated
import logging

from ..services.llm import LLMService
from ..dependencies import get_llm_service
from .arguments_schemas import DetectArgumentsRequest, DetectArgumentsResponse
from ..services.arguments import (
    dummy_detect_arguments,
    get_arguments_from_llm,
    add_new_premises_to_lookup,
    filter_existing_arguments,
    translate_arguments,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/arguments", tags=["arguments"])


@router.post("/detect", response_model=DetectArgumentsResponse)
async def detect_arguments(
    request: DetectArgumentsRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
    use_dummy: bool = False,
    sentence_pool_minimum: int = 3,
) -> DetectArgumentsResponse:
    """Detect logically valid arguments over the current element set.

    Builds a sentence-index lookup from the request elements, queries the LLM
    (or the dummy fixture when ``use_dummy=true``), filters out arguments already
    present in the state, adds any LLM-supplied suppressed premises to the lookup,
    and returns the deduplicated numeric arguments alongside their translated forms.

    Raises 422 if the sentence pool is smaller than ``sentence_pool_minimum``.
    """
    n_unnegated_sentence_pool = len(request.elements)
    if n_unnegated_sentence_pool < sentence_pool_minimum:
        raise HTTPException(
            status_code=422,
            detail=f"There are fewer than {sentence_pool_minimum} elements forming the sentence pool.",
        )
    try:
        if use_dummy:
            logger.info("Returning dummy arguments")
            return dummy_detect_arguments(
                n_unnegated_sentence_pool=n_unnegated_sentence_pool,
                elements=request.elements,
                round=request.round,
            )

        logger.info(
            f"Requesting detected arguments from model '{llm.model}' for {n_unnegated_sentence_pool} elements"
        )
        initial_lookup = {index + 1: e for index, e in enumerate(request.elements)}
        llm_response = await get_arguments_from_llm(
            llm=llm, lookup=initial_lookup, relations=request.relations
        )
        logger.info(
            f"Received {len(llm_response.detected_arguments)} arguments from LLM."
        )

        lookup_w_premises = add_new_premises_to_lookup(
            lookup=initial_lookup,
            added_premises=llm_response.added_premises,
            elements=request.elements,
            round=request.round,
            model=llm.model,
        )
        filtered_arguments = filter_existing_arguments(
            llm_response.detected_arguments, request.relations, lookup_w_premises
        )
        translated = translate_arguments(
            detected_arguments=filtered_arguments, lookup=lookup_w_premises
        )

        return DetectArgumentsResponse(
            num_arguments=filtered_arguments,
            translated_arguments=translated,
            lookup=lookup_w_premises,
            input_tokens=llm_response.input_tokens,
            output_tokens=llm_response.output_tokens,
        )

    except Exception as e:
        logger.error(f"Detecing arguments failed: {e}", exc_info=True)
        raise
