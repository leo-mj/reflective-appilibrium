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
    partition_arguments,
    surface_arguments,
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
    (or the sample fixture when ``use_dummy=true``), checks each argument and
    tags those that fail, filters out arguments already present in the state,
    adds any LLM-supplied suppressed premises to the lookup, and returns the
    deduplicated numeric arguments alongside their translated forms.

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
            logger.info("Returning sample arguments")
            return dummy_detect_arguments(
                elements=request.elements,
                round=request.round,
                relations=request.relations,
            )

        logger.info(
            f"Requesting detected arguments from model '{llm.model}' for {n_unnegated_sentence_pool} elements"
        )
        initial_lookup = {index + 1: e for index, e in enumerate(request.elements)}
        llm_response = await get_arguments_from_llm(
            llm=llm,
            lookup=initial_lookup,
            relations=request.relations,
            topic=request.topic,
        )
        logger.info(
            f"Received {len(llm_response.detected_arguments)} arguments from LLM."
        )

        # The checker (when request.verify): check validity, auto-trim
        # redundant premises and split meaning postulates (kept out of the
        # pool) from substantive added premises (surfaced as elements) — or,
        # for an argument that fails, tag it with why. When verification is off
        # arguments are surfaced as proposed.
        if not request.verify:
            logger.info(
                "Argument checker disabled; surfacing LLM arguments unverified."
            )
        partition = partition_arguments(
            llm_response.detected_arguments,
            llm_response.added_premises,
            verify=request.verify,
            pool_indices=initial_lookup.keys(),
            pool_texts={n: e.text for n, e in initial_lookup.items()},
        )
        failed = sum(f is not None for f in partition.failures)
        if failed or partition.dropped:
            logger.info(
                f"{failed} argument(s) failed the checker; {partition.dropped} dropped."
            )
        return surface_arguments(
            partition,
            lookup=initial_lookup,
            elements=request.elements,
            relations=request.relations,
            round=request.round,
            model=llm.model,
            input_tokens=llm_response.input_tokens,
            output_tokens=llm_response.output_tokens,
        )

    except Exception as e:
        # The type, not the message: see logging_setup.ContentFreeFormatter.
        logger.error(f"Detecting arguments failed: {type(e).__name__}", exc_info=True)
        raise
