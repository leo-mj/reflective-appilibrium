"""Analytical RE scoring service — computes account, systematicity, and withdrawal deltas without a full simulation."""

from typing import List, Dict, Optional
import logging

from . import rethon_import  # noqa: F401 — must precede rethon; see that module
from theodias import Position, StandardPosition, BDDDialecticalStructure
from rethon import StandardLocalReflectiveEquilibrium
from ..models.re_state import REElement, REHistoryEvent, RERelation
from ..routers.rethon_schemas import (
    ModelWeights,
    ElementDelta,
    RoundScores,
    ScoreChangesResponse,
    QuickScoreResponse,
)
from .rethon_caps import (
    NO_CAPS,
    RETHON_ARGUMENT_TYPES,
    ElementCaps,
    enforce_element_cap,
)
from .rethon_simulation import (
    build_numerical_arguments,
    get_final_score,
)

logger = logging.getLogger(__name__)


def _build_type_positions(
    elements: List[REElement],
    id_to_index: Dict[str, int],
    n: int,
) -> tuple[Position, Position]:
    """Build commitment (C) and theory (T) positions from element types.

    - **All** elements (judgments, principles, background theories) that are
      active/revised (→ positive) or rejected (→ negative) form the commitment
      position.  An agent can be committed to a principle just as much as to a
      particular judgment.
    - Only principle and background-theory (type "theory") elements that are
      active/revised form the theory position, because these are the elements
      that constitute the explanatory framework.

    Principles and background theories therefore appear in *both* C and T.

    Allows Z to be computed analytically without running a full RE simulation.
    Returns ``(c_pos, t_pos)``.
    """
    c_set: set[int] = {
        (
            id_to_index[el.id]
            if el.status in ("active", "revised")
            else -id_to_index[el.id]
        )
        for el in elements
        if el.status in ("active", "revised", "rejected") and el.id in id_to_index
    }
    t_set: set[int] = {
        id_to_index[el.id]
        for el in elements
        if el.type in ("principle", "theory")
        and el.status in ("active", "revised")
        and el.id in id_to_index
    }
    return (
        StandardPosition.from_set(c_set, n),
        StandardPosition.from_set(t_set, n),
    )


def compute_score_changes(
    elements: List[REElement],
    relations: List[RERelation],
    local: bool = True,
    weights: Optional[ModelWeights] = None,
    caps: ElementCaps = NO_CAPS,
) -> ScoreChangesResponse:
    """Batch-compute withdrawal Z-score deltas for all active/revised elements.

    Uses an analytical approach: every committed element forms the commitment
    position (C) and principle/theory elements form the theory position (T), as
    in ``_build_type_positions`` — the same vocabulary the simulation's theory
    is restricted to (``rethon_theory``).  No full RE simulation is run.

    "Analytical" is not "cheap": the BDD below is built over the whole sentence
    pool and then queried once per element, so this is the most size-sensitive
    thing in the module. Hence the cap, and hence it being checked here rather
    than only in ``validate_and_build``, which this function never calls.
    """
    n = len(elements)
    # Before the try below, deliberately: that block turns any exception into an
    # empty response, so a cap raised inside it would be swallowed and the
    # oversized BDD would simply be built again on the next keystroke.
    enforce_element_cap(elements, relations, caps)
    target_elements = [
        el
        for el in elements
        if el.status in ("active", "revised")
        and el.type in ("judgment", "principle", "theory")
    ]
    empty = ScoreChangesResponse(
        withdrawal_deltas=[
            ElementDelta(element_id=el.id, delta_account=None, delta_systematicity=None)
            for el in target_elements
        ],
    )
    if n < 3:
        return empty
    arg_relations = [r for r in relations if r.type in RETHON_ARGUMENT_TYPES]
    if not arg_relations:
        return empty
    try:
        built = build_numerical_arguments(elements=elements, relations=arg_relations)
        id_to_index: Dict[str, int] = {el.id: i + 1 for i, el in enumerate(elements)}
        bdd_ds = BDDDialecticalStructure.from_arguments(
            arguments=built.num_arguments,
            n_unnegated_sentence_pool=n,
        )
        # C₀: all active/revised (positive) and rejected (negative) elements.
        # T*: only principle and theory elements that are active/revised.
        # Principles and background theories appear in both C₀ and T*.
        c0_set: set[int] = {
            (
                id_to_index[el.id]
                if el.status in ("active", "revised")
                else -id_to_index[el.id]
            )
            for el in elements
            if el.status in ("active", "revised", "rejected")
        }
        t_set: set[int] = {
            id_to_index[el.id]
            for el in elements
            if el.type in ("principle", "theory") and el.status in ("active", "revised")
        }
        if not t_set:
            return empty  # No theory position — Z cannot be computed.
        c0_pos = StandardPosition.from_set(c0_set, n)
        t_pos = StandardPosition.from_set(t_set, n)
        re_obj = StandardLocalReflectiveEquilibrium(
            dialectical_structure=bdd_ds, initial_commitments=c0_pos
        )
        if weights is not None:
            re_obj.set_model_parameters({"weights": weights.model_dump()})
        # Baseline account and systematicity: C = C₀, T = T*.
        baseline_account = re_obj.account(c0_pos, t_pos)
        baseline_systematicity = re_obj.systematicity(t_pos)
        withdrawal_deltas: List[ElementDelta] = []
        for el in target_elements:
            try:
                idx = id_to_index[el.id]  # always positive for active/revised
                if el.type == "judgment":
                    # Judgments live only in C — remove from C, T unchanged.
                    c_mod_pos = StandardPosition.from_set(c0_set - {idx}, n)
                    delta_account = re_obj.account(c_mod_pos, t_pos) - baseline_account
                    delta_systematicity = 0.0  # T unchanged
                else:
                    # Principles/theories live in both C and T — remove from both.
                    c_mod_pos = StandardPosition.from_set(c0_set - {idx}, n)
                    t_mod_pos = StandardPosition.from_set(t_set - {idx}, n)
                    delta_account = (
                        re_obj.account(c_mod_pos, t_mod_pos) - baseline_account
                    )
                    delta_systematicity = (
                        re_obj.systematicity(t_mod_pos) - baseline_systematicity
                    )
            except Exception:
                delta_account = None
                delta_systematicity = None
            withdrawal_deltas.append(
                ElementDelta(
                    element_id=el.id,
                    delta_account=delta_account,
                    delta_systematicity=delta_systematicity,
                )
            )
        return ScoreChangesResponse(withdrawal_deltas=withdrawal_deltas)
    except Exception:
        return empty


def _history(el: REElement) -> List[REHistoryEvent]:
    """An element's events, oldest first, rebuilt from the single-event fields
    older states carry when there is no list — as ``historyOf`` does in
    app/src/utils/stateUtils.js."""
    if el.history is not None:
        return sorted(el.history, key=lambda e: e.round)
    events = []
    if el.revised_round:
        events.append(REHistoryEvent(round=el.revised_round, type="revised"))
    if el.rejected_round:
        events.append(REHistoryEvent(round=el.rejected_round, type="rejected"))
    if el.withdrawn_round:
        events.append(REHistoryEvent(round=el.withdrawn_round, type="withdrawn"))
    return sorted(events, key=lambda e: e.round)


def status_at_step(el: REElement, step: int) -> str:
    """The element's status as it stood at ``step``: its events up to and
    including that step, folded as ``foldHistory`` in app/src/utils/stateUtils.js
    folds them. An element with no events keeps the status it has — a
    ``possible`` one, and anything never touched."""
    events = _history(el)
    if not events:
        return el.status
    status, revised = "active", False
    for ev in events:
        if ev.round > step:
            break
        if ev.type == "withdrawn":
            status = "withdrawn"
        elif ev.type == "rejected":
            status = "rejected"
        elif ev.type == "reinstated":
            status = "revised" if revised else "active"
        elif ev.type == "revised":
            revised = True
            if status == "active":
                status = "revised"
    return status


def elements_at_step(elements: List[REElement], step: int) -> List[REElement]:
    """The elements of the process as it stood at ``step``: those added by then,
    each with the status it had then.

    Statuses are of that step, not of now. They used to be now's, so an element
    withdrawn at step 50 was scored as withdrawn at step 10, and History's early
    scores reflected today's commitments rather than the ones then held.

    A withdrawn element stays in, uncommitted: the sentence pool is the process's
    whole vocabulary, as it is for the full simulation, and an element the reader
    set aside can still be the one that makes the position more coherent. They
    used to be dropped from the pool at their withdrawal, and only if withdrawn
    by the single-event field older states use.
    """
    return [
        el.model_copy(update={"status": status_at_step(el, step)})
        for el in elements
        if (el.added_round or 1) <= step
    ]


def replaced_by_step(rel: RERelation, step: int) -> bool:
    """Whether a revision had replaced this link by ``step``.

    A link an argument's revision replaced carries ``superseded_by`` and was
    withdrawn at that step, never to be reinstated. Up to it, it is part of the
    argument as it then stood; from it on, it is the record of what the argument
    was, and no premise. A withdrawal the reader made is another matter: that
    argument stays, so a withdrawn element can earn its way back (see
    ``rethon_arguments``). Without a withdrawal step to go by, a replaced link
    counts as replaced throughout.
    """
    if not rel.superseded_by:
        return False
    withdrawals = [e.round for e in rel.history or [] if e.type == "withdrawn"]
    replaced_at = max(withdrawals) if withdrawals else rel.withdrawn_round
    return replaced_at is None or replaced_at <= step


def relations_at_step(
    relations: List[RERelation], element_ids: set, step: int
) -> List[RERelation]:
    """The relations of the process as it stood at ``step``: added by then,
    between elements present then, and not yet replaced by a revision.

    The whole process is sent for History's scores, replaced links included,
    since they are what the early steps are made of. Kept after the step that
    replaced them, they had the old premises scored beside the new ones.
    """
    return [
        rel
        for rel in relations
        if (rel.added_round or 1) <= step
        and rel.from_id in element_ids
        and rel.to_id in element_ids
        and not replaced_by_step(rel, step)
    ]


def compute_score_per_round(
    elements: List[REElement],
    relations: List[RERelation],
    rounds: int,
    local: bool = True,
    weights: Optional[ModelWeights] = None,
) -> List[RoundScores]:
    """The final equilibrium Z-score at each workflow round from 1 to ``rounds``.

    Elements and relations are filtered to those present at each round before a
    full simulation is run over them. A round the simulation cannot score — too
    few elements, no arguments yet — gets ``scores=None``, since
    ``get_final_score`` turns every failure into one.

    Module-level, and the element cap left to the caller, so it can run in a
    simulation worker: a closure does not pickle, and neither does the
    ``HTTPException`` the cap raises. It used to be a closure in the router.
    """
    results: List[RoundScores] = []
    for r in range(1, rounds + 1):
        elements_at_r = elements_at_step(elements, r)
        el_ids = {el.id for el in elements_at_r}
        relations_at_r = relations_at_step(relations, el_ids, r)
        results.append(
            RoundScores(
                round=r,
                scores=get_final_score(elements_at_r, relations_at_r, local, weights),
            )
        )
    return results


def compute_quick_score(
    elements: List[REElement],
    relations: List[RERelation],
    weights: Optional[ModelWeights] = None,
    caps: ElementCaps = NO_CAPS,
) -> QuickScoreResponse:
    """Compute account and systematicity for the current element set analytically.

    Derives C (all active/revised/rejected elements) and T (active/revised
    principle/theory elements) directly from element types — no simulation or
    prior evolution is required.

    Returns ``account=None, systematicity=None`` when there are fewer than 3
    elements, no argument relations, or no active principle/theory elements.
    Too *many* elements is the one size problem it does not answer with a null:
    that is a 422, because a blank badge would say "nothing to score here" when
    what happened is that this deployment declined to.
    """
    # Outside the try for the reason given in compute_score_changes.
    enforce_element_cap(elements, relations, caps)
    try:
        n = len(elements)
        if n < 3:
            return QuickScoreResponse(account=None, systematicity=None)
        arg_relations = [r for r in relations if r.type in RETHON_ARGUMENT_TYPES]
        if not arg_relations:
            return QuickScoreResponse(account=None, systematicity=None)
        if not any(
            el.type in ("principle", "theory") and el.status in ("active", "revised")
            for el in elements
        ):
            return QuickScoreResponse(account=None, systematicity=None)
        built = build_numerical_arguments(elements=elements, relations=arg_relations)
        id_to_index: Dict[str, int] = {el.id: i + 1 for i, el in enumerate(elements)}
        bdd_ds = BDDDialecticalStructure.from_arguments(
            arguments=built.num_arguments,
            n_unnegated_sentence_pool=n,
        )
        c_pos, t_pos = _build_type_positions(elements, id_to_index, n)
        # RE object used only for its scoring methods — no re_process() call.
        re_obj = StandardLocalReflectiveEquilibrium(
            dialectical_structure=bdd_ds, initial_commitments=c_pos
        )
        if weights:
            re_obj.set_model_parameters({"weights": weights.model_dump()})
        return QuickScoreResponse(
            account=re_obj.account(c_pos, t_pos),
            systematicity=re_obj.systematicity(t_pos),
        )
    except Exception:
        return QuickScoreResponse(account=None, systematicity=None)
