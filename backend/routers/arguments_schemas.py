"""Pydantic request/response models and translation utility for the arguments router."""

from typing import List, Dict, Literal, Optional
from pydantic import BaseModel

from ..models.re_state import ElementType, REElement, RERelation


class DetectArgumentsRequest(BaseModel):
    """Payload for ``POST /api/arguments/detect``.

    ``verify`` controls the formal argument checker: when ``True`` (default)
    each LLM-proposed argument is verified, auto-trimmed, and stripped of
    meaning postulates before being surfaced.  When ``False`` the checker is
    bypassed — arguments are surfaced exactly as proposed and every added
    premise (postulates included) enters the pool — for inspecting raw model
    output or working with models that cannot supply valid logical forms.
    """

    elements: List[REElement]
    relations: List[RERelation] = []
    round: str
    topic: str = ""
    verify: bool = True


class AddedPremise(BaseModel):
    """A suppressed premise supplied by the LLM to make an argument formally valid.

    ``form`` is the premise's logical content as a propositional formula over
    the *other* sentences' indices (e.g. ``"(3 & 4) -> 7"``; never its own
    index); the validity checker uses it to verify the reconstructed
    argument.  ``role`` distinguishes:

    - ``"premise"`` — substantive normative or empirical content; surfaced to
      the user and, on acceptance, added to the element pool.
    - ``"postulate"`` — a meaning postulate (Carnap 1952): true solely in
      virtue of the meanings of the sentences involved.  Verified like any
      premise but kept out of the pool; its text is folded into the created
      relation's explanation instead.

    ``role`` defaults to ``"premise"`` — the safe direction, since a
    misclassified premise hides a contestable commitment while a
    misclassified postulate merely adds clutter.
    """

    index: int
    type: ElementType
    text: str
    form: Optional[str] = None
    role: Literal["premise", "postulate"] = "premise"


class LLMArgumentsResponse(BaseModel):
    """Raw argument data returned by the LLM, before verification, deduplication, and translation."""

    detected_arguments: List[List[int]]
    added_premises: List[AddedPremise]
    input_tokens: int
    output_tokens: int


class DetectArgumentsResponse(BaseModel):
    """Detected arguments in numeric and translated form, plus the element lookup.

    ``num_arguments`` uses integer indices (negative = negated); ``translated_arguments``
    is the parallel list with each index replaced by its REElement.  ``lookup`` maps
    every integer index (positive and negative) to an REElement so callers can perform
    further translations without re-requesting.  ``argument_postulates`` is parallel to
    ``num_arguments``: the meaning-postulate texts each argument relies on (usually
    empty).  ``rejected_count`` is the number of LLM proposals that failed formal
    verification and were dropped.  ``model`` is the model that generated the
    arguments (mirrors the other assist endpoints, so the UI can disclose it).
    """

    num_arguments: List[List[int]]
    translated_arguments: List[List[REElement]] = []
    lookup: Dict
    argument_postulates: List[List[str]] = []
    rejected_count: int = 0
    model: str = ""
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
