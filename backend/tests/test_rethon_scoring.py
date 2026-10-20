"""The scoring evaluates the theory the simulation starts from.

An open conflict between held principles makes the whole held theory
inconsistent, and theodias closes an inconsistent position to the whole pool —
every sentence and its negation. rethon's account then penalises every sentence
as a contradiction, whatever the commitments hold: account was 0, and every
element's "if withdrawn" delta 0.000. The scoring takes the held theory's
largest consistent part instead, as ``seeded_theory`` does.

1 = J1, 2 = J2, 3 = P1, 4 = P2, 5 = P3, 6 = P4.  P1 → J1, P2 + P3 → J2,
P4 → ¬J2.  Dropping P2, P3 or P4 leaves three principles either way, and
P4 is the least confident, so it is the principle left out.
"""

import pytest
from rethon import StandardLocalReflectiveEquilibrium
from theodias import BDDDialecticalStructure, StandardPosition

from backend.models.re_state import REElement, RERelation
from backend.services.rethon_scoring import (
    _build_type_positions,
    compute_quick_score,
    compute_score_changes,
)
from backend.services.rethon_simulation import build_numerical_arguments
from backend.services.rethon_theory import held_theory, make_re, theory_sentences

N = 6
C = {1, 2, 3, 4, 5, 6}


def _element(id, type, confidence=0.8):
    return REElement(
        id=id,
        type=type,
        status="active",
        confidence=confidence,
        text=id,
        added_round=1,
    )


def _relation(from_id, to_id, type, argument_id=None):
    return RERelation(
        from_id=from_id,
        to_id=to_id,
        type=type,
        explanation="",
        added_round=1,
        argument_id=argument_id,
    )


ELEMENTS = [
    _element("J1", "judgment"),
    _element("J2", "judgment"),
    _element("P1", "principle"),
    _element("P2", "principle"),
    _element("P3", "principle"),
    _element("P4", "principle", confidence=0.3),
]
RELATIONS = [
    _relation("P1", "J1", "entails", "a1"),
    _relation("P2", "J2", "jointly_entails", "a2"),
    _relation("P3", "J2", "jointly_entails", "a2"),
    _relation("P4", "J2", "precludes", "a3"),
]


@pytest.fixture(scope="module")
def re_obj():
    built = build_numerical_arguments(elements=ELEMENTS, relations=RELATIONS)
    ds = BDDDialecticalStructure.from_arguments(
        arguments=built.num_arguments, n_unnegated_sentence_pool=N
    )
    return StandardLocalReflectiveEquilibrium(
        dialectical_structure=ds,
        initial_commitments=StandardPosition.from_set(C, N),
    )


def _account(re_obj, commitments, theory):
    return re_obj.account(
        StandardPosition.from_set(commitments, N),
        StandardPosition.from_set(theory, N),
    )


def _deltas():
    return {
        d.element_id: d
        for d in compute_score_changes(ELEMENTS, RELATIONS).withdrawal_deltas
    }


def test_the_whole_held_theory_would_score_nothing(re_obj):
    # The premise of the rest: held together, the four principles account for
    # nothing at all.
    assert not re_obj.dialectical_structure().is_consistent(
        StandardPosition.from_set({3, 4, 5, 6}, N)
    )
    assert _account(re_obj, C, {3, 4, 5, 6}) == 0


def test_the_quick_score_takes_the_largest_consistent_part(re_obj):
    account = compute_quick_score(ELEMENTS, RELATIONS).account
    assert account > 0
    assert account == pytest.approx(_account(re_obj, C, {3, 4, 5}))


def test_the_quick_score_names_the_theory_it_scored():
    # What the Simulate tab rings on the graph: P4 is left out.
    assert compute_quick_score(ELEMENTS, RELATIONS).theory == ["P1", "P2", "P3"]


def test_withdrawing_an_accounted_judgment_lowers_account():
    # P1 entails J1: without J1 the theory implies something not committed to.
    assert _deltas()["J1"].delta_account < 0


def test_withdrawing_a_principle_lets_the_one_it_blocked_back_in(re_obj):
    # Without P2, P4 no longer conflicts with what is held, so the theory is
    # P1, P3 and P4 — as a simulation started then would take it.
    baseline = _account(re_obj, C, {3, 4, 5})
    expected = _account(re_obj, C - {4}, {3, 5, 6}) - baseline
    assert _deltas()["P2"].delta_account == pytest.approx(expected)


def test_the_scored_theory_is_the_simulations_first():
    built = build_numerical_arguments(elements=ELEMENTS, relations=RELATIONS)
    ds = BDDDialecticalStructure.from_arguments(
        arguments=built.num_arguments, n_unnegated_sentence_pool=N
    )
    c_pos, t_pos = _build_type_positions(ELEMENTS, built.lookup, ds, N)
    re = make_re(
        ds,
        c_pos,
        True,
        theory_sentences(built.lookup),
        held_theory(built.lookup),
    )
    re.re_process()
    assert re.state().evolution[1] == t_pos
