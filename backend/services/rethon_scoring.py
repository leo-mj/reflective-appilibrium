"""Analytical RE scoring service — computes account, systematicity, and withdrawal deltas without a full simulation."""

from typing import List, Dict, Optional
import logging

from theodias import Position, StandardPosition, BDDDialecticalStructure
from rethon import StandardLocalReflectiveEquilibrium
from ..models.re_state import REElement, RERelation
from ..routers.rethon_schemas import (
    ModelWeights,
    ElementDelta,
    ScoreChangesResponse,
    QuickScoreResponse,
)
from .rethon_simulation import build_numerical_arguments

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
) -> ScoreChangesResponse:
    """Batch-compute withdrawal Z-score deltas for all active/revised elements.

    Uses an analytical approach: judgment elements form the commitment position
    (C) and principle/theory elements form the theory position (T).  Z is
    computed directly from ``re_obj.achievement(C, T, C₀)`` — no full RE
    simulation is run.
    """
    n = len(elements)
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
    arg_relations = [
        r for r in relations if r.type in ("jointly_entails", "jointly_precludes")
    ]
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


def compute_quick_score(
    elements: List[REElement],
    relations: List[RERelation],
    weights: Optional[ModelWeights] = None,
) -> QuickScoreResponse:
    """Compute account and systematicity for the current element set analytically.

    Derives C (all active/revised/rejected elements) and T (active/revised
    principle/theory elements) directly from element types — no simulation or
    prior evolution is required.

    Returns ``account=None, systematicity=None`` when there are fewer than 3
    elements, no argument relations, or no active principle/theory elements.
    """
    try:
        n = len(elements)
        if n < 3:
            return QuickScoreResponse(account=None, systematicity=None)
        arg_relations = [
            r for r in relations if r.type in ("jointly_entails", "jointly_precludes")
        ]
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
