"""History scores each step as the process stood then.

``compute_score_per_round`` used to take every element's status as of now: an
element withdrawn at step 50 was scored as withdrawn at step 10, so History's
early scores reflected today's commitments. And it read only the single
``withdrawnRound`` older states carry, removing those elements from the pool
while one withdrawn by a history event stayed in with its present status.

These follow the rules of ``foldHistory`` in app/src/utils/stateUtils.js, which
History's own playback uses on the frontend.
"""

from backend.models.re_state import REElement
from backend.services.rethon_scoring import elements_at_step, status_at_step


def el(id_="J1", status="active", added=1, **extra):
    return REElement.model_validate(
        {
            "id": id_,
            "type": "judgment",
            "status": status,
            "confidence": 0.7,
            "text": "a judgment",
            "addedRound": added,
            **extra,
        }
    )


def test_a_withdrawal_counts_from_its_step_and_not_before():
    j = el(status="withdrawn", history=[{"round": 50, "type": "withdrawn"}])
    assert status_at_step(j, 10) == "active"
    assert status_at_step(j, 49) == "active"
    assert status_at_step(j, 50) == "withdrawn"


def test_withdrawn_and_reinstated_is_active_again_from_the_reinstatement():
    j = el(
        history=[
            {"round": 3, "type": "withdrawn"},
            {"round": 6, "type": "reinstated"},
        ]
    )
    assert [status_at_step(j, s) for s in (2, 3, 5, 6)] == [
        "active",
        "withdrawn",
        "withdrawn",
        "active",
    ]


def test_a_revised_element_comes_back_revised():
    j = el(
        status="revised",
        history=[
            {"round": 2, "type": "revised", "previousText": "old"},
            {"round": 4, "type": "withdrawn"},
            {"round": 7, "type": "reinstated"},
        ],
    )
    assert status_at_step(j, 1) == "active"
    assert status_at_step(j, 3) == "revised"
    assert status_at_step(j, 5) == "withdrawn"
    assert status_at_step(j, 8) == "revised"


def test_a_rejection_counts_from_its_step():
    j = el(status="rejected", history=[{"round": 5, "type": "rejected"}])
    assert status_at_step(j, 4) == "active"
    assert status_at_step(j, 5) == "rejected"


def test_the_single_field_older_states_carry_is_read_too():
    j = el(status="withdrawn", withdrawnRound=5)
    assert status_at_step(j, 4) == "active"
    assert status_at_step(j, 5) == "withdrawn"


def test_an_element_with_no_events_keeps_its_status():
    assert status_at_step(el(status="possible"), 3) == "possible"
    assert status_at_step(el(), 3) == "active"


def test_a_step_holds_what_had_been_added_by_then():
    ids = [e.id for e in elements_at_step([el("J1", added=1), el("J2", added=4)], 3)]
    assert ids == ["J1"]


def test_a_withdrawn_element_stays_in_uncommitted():
    """In the pool, as it is for the full simulation, so it can still be the one
    that makes the position more coherent. It used to be dropped from its
    withdrawal on."""
    j = el(status="withdrawn", history=[{"round": 5, "type": "withdrawn"}])
    [at_4] = elements_at_step([j], 4)
    [at_9] = elements_at_step([j], 9)
    assert at_4.status == "active"
    assert at_9.status == "withdrawn"
