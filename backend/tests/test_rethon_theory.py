"""The simulation's theory is made of principles and background theories only.

The scoring in ``rethon_scoring`` evaluates the active principles and theories
as the theory; rethon's standard model would take any consistent position,
judgments included. These tests run real rethon on a structure where the two
disagree: J1 implies J2 and J3, so J1 alone is the most systematic theory on
offer, and only the restriction keeps it out.
"""

import pytest
from fastapi import HTTPException
from theodias import BDDDialecticalStructure, StandardPosition

from backend.models.re_state import REElement, RERelation
from backend.services.rethon_simulation import validate_and_build
from backend.services.rethon_theory import (
    TheoryRestrictedGlobalRE,
    held_theory,
    largest_consistent_part,
    make_re,
    theory_sentences,
)

# 1 = J1, 2 = J2, 3 = J3, 4 = P1.  J1 → J2, J1 → J3, P1 → J2.
ARGUMENTS = [[1, 2], [1, 3], [4, 2]]
N = 4
PRINCIPLES = {4}


def _final_state(local, restricted_to):
    ds = BDDDialecticalStructure.from_arguments(
        arguments=ARGUMENTS, n_unnegated_sentence_pool=N
    )
    re = make_re(ds, StandardPosition.from_set({1, 2, 3, 4}, N), local, restricted_to)
    re.re_process()
    return re.state()


@pytest.mark.parametrize("local", [True, False])
def test_standard_rethon_would_take_a_judgment_as_its_theory(local):
    # The premise of every other test here: without the restriction the
    # structure does produce a theory made of a judgment.
    theory = _final_state(local, None).last_theory().as_set()
    assert 1 in theory


@pytest.mark.parametrize("local", [True, False])
def test_every_theory_is_made_of_principles_and_theories(local):
    state = _final_state(local, PRINCIPLES)
    for i, position in enumerate(state.evolution):
        if i % 2 == 1:  # odd steps are theories
            assert position.as_set() <= PRINCIPLES, position.as_set()
    assert state.last_theory().as_set() == {4}


def test_a_negated_principle_is_no_theory():
    # Withdrawing a principle is not asserting its negation, so ¬P1 is not a
    # position the theory may take, though P1 itself is.
    re = make_re(
        BDDDialecticalStructure.from_arguments(
            arguments=ARGUMENTS, n_unnegated_sentence_pool=N
        ),
        StandardPosition.from_set({1, 2}, N),
        True,
        PRINCIPLES,
    )
    assert re.may_be_theory(StandardPosition.from_set({4}, N))
    assert not re.may_be_theory(StandardPosition.from_set({-4}, N))
    assert not re.may_be_theory(StandardPosition.from_set({1, 4}, N))


def test_the_global_model_still_filters_rethons_groups():
    # The groups are rethon's private attribute, reached by its mangled name.
    # If rethon renames it this is the test that says so.
    assert hasattr(
        TheoryRestrictedGlobalRE(
            BDDDialecticalStructure.from_arguments(
                arguments=ARGUMENTS, n_unnegated_sentence_pool=N
            ),
            StandardPosition.from_set({1}, N),
            PRINCIPLES,
        ),
        TheoryRestrictedGlobalRE._GROUPS,
    )


def _element(id, type, status="active"):
    return REElement(
        id=id, type=type, status=status, confidence=0.8, text=id, added_round=1
    )


def test_theory_sentences_are_the_principles_and_theories_whatever_their_status():
    # A withdrawn principle can be taken up again, as a withdrawn commitment can.
    lookup = {
        1: _element("J1", "judgment"),
        2: _element("P1", "principle", "withdrawn"),
        3: _element("T1", "theory"),
    }
    assert theory_sentences(lookup) == {2, 3}


def test_a_process_without_principles_or_theories_is_refused():
    elements = [_element(f"J{i}", "judgment") for i in (1, 2, 3)]
    relations = [
        RERelation(
            from_id="J1", to_id="J2", type="entails", explanation="", added_round=1
        )
    ]
    with pytest.raises(HTTPException) as refused:
        validate_and_build(elements, relations)
    assert refused.value.status_code == 422
    assert "principle or background theory" in refused.value.detail


# ── The first theory is the one the user holds ───────────────────────────────
#
# 1 = J1, 2 = J2, 3 = J3, 4 = P1, 5 = P2.  P1 → J1, P2 → J2, P2 → J3.  The user
# holds everything, P1 and P2 among it.
SEEDED_ARGUMENTS = [[4, 1], [5, 2], [5, 3]]
HELD = {4, 5}


def _seeded_run(local, held, arguments=SEEDED_ARGUMENTS):
    ds = BDDDialecticalStructure.from_arguments(
        arguments=arguments, n_unnegated_sentence_pool=5
    )
    re = make_re(ds, StandardPosition.from_set({1, 2, 3, 4, 5}, 5), local, {4, 5}, held)
    re.re_process()
    return re.state()


@pytest.mark.parametrize("local", [True, False])
def test_the_first_theory_is_the_held_one(local):
    assert _seeded_run(local, HELD).evolution[1].as_set() == HELD


def test_an_unseeded_local_start_can_settle_short_of_the_held_theory():
    # Why the start is seeded. From rethon's own start near the empty position,
    # local search takes P2 alone and stays there, withdrawing J1 and P1; from
    # the held theory it keeps both principles — the equilibrium global search
    # finds from either start. If rethon's search changes, this is the case to
    # look at again, not a test to loosen.
    unseeded = _seeded_run(True, ())
    assert unseeded.last_theory().as_set() == {5}
    assert _seeded_run(True, HELD).last_theory().as_set() == HELD
    assert _seeded_run(False, ()).last_theory().as_set() == HELD


@pytest.mark.parametrize("local", [True, False])
def test_an_inconsistent_held_theory_starts_from_its_largest_consistent_part(local):
    # P1 → ¬P2 makes the two held principles inconsistent together, and a
    # theory must be consistent. The start keeps what it can rather than
    # dropping to rethon's own start, which began the demo from one principle;
    # the two parts are equally large, so the order held_theory gives — most
    # confident first — decides.
    first = _seeded_run(local, (4, 5), SEEDED_ARGUMENTS + [[4, -5]]).evolution[1]
    assert first.as_set() == {4}
    first = _seeded_run(local, (5, 4), SEEDED_ARGUMENTS + [[4, -5]]).evolution[1]
    assert first.as_set() == {5}


def test_the_largest_consistent_part_is_largest_by_count():
    # P1 conflicts with P2 and with P3, which are consistent together. Taken
    # most confident first and kept while consistent, P1 alone would stand;
    # the largest part is P2 and P3, however confident P1 is.
    ds = BDDDialecticalStructure.from_arguments(
        arguments=[[4, -5], [4, -6]], n_unnegated_sentence_pool=6
    )
    assert largest_consistent_part(ds, (4, 5, 6), 6) == {5, 6}
    # Consistent as a whole, it is kept whole; nothing held, nothing kept.
    assert largest_consistent_part(ds, (5, 6), 6) == {5, 6}
    assert largest_consistent_part(ds, (), 6) == set()


@pytest.mark.parametrize("local", [True, False])
def test_nothing_held_falls_back_to_rethons_start(local):
    assert _seeded_run(local, ()).evolution[1].as_set() <= {4, 5}


def test_the_held_theory_is_what_the_scoring_takes_as_the_theory():
    # Active and revised principles and theories: not withdrawn ones, which
    # stay available as candidates, and never judgments.
    lookup = {
        1: _element("J1", "judgment"),
        2: _element("P1", "principle"),
        3: _element("P2", "principle", "withdrawn"),
        4: _element("T1", "theory", "revised"),
        5: _element("P3", "principle", "rejected"),
    }
    assert set(held_theory(lookup)) == {2, 4}
    assert theory_sentences(lookup) == {2, 3, 4, 5}


def test_the_held_theory_comes_most_confident_first():
    # The order that decides between equally large consistent parts.
    lookup = {
        1: _element("P1", "principle").model_copy(update={"confidence": 0.3}),
        2: _element("P2", "principle").model_copy(update={"confidence": 1.0}),
        3: _element("P3", "principle").model_copy(update={"confidence": 0.3}),
    }
    assert held_theory(lookup) == (2, 1, 3)


# ── Reproducible ties ─────────────────────────────────────────────────────────
#
# rethon picks at random among equally good candidates; the same request used
# to withdraw different elements on each press.


@pytest.mark.parametrize("local", [True, False])
def test_the_same_request_gives_the_same_process(local):
    # Four judgments, one principle accounting for two of them: plenty of
    # candidates that tie on achievement.
    arguments = [[5, 1], [5, 2]]
    runs = []
    for _ in range(4):
        ds = BDDDialecticalStructure.from_arguments(
            arguments=arguments, n_unnegated_sentence_pool=5
        )
        re = make_re(
            ds, StandardPosition.from_set({1, 2, 3, 4, 5}, 5), local, {5}, (5,)
        )
        re.set_model_parameters(neighbourhood_depth=2)
        re.re_process()
        runs.append([p.as_set() for p in re.state().evolution])
    assert all(run == runs[0] for run in runs)
