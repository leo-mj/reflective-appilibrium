"""Defects found in the audit of 2026-11-13 (plans/audit-2026-11-13.md), each
asserted to be *still there* — the convention of app/e2e/known-issues.spec.js.

Green while a defect is open, red the moment it is fixed: the failure names the
entry, and the fix is to turn the assertion round (each comment says into what)
and move the test beside the code it covers. Nothing here is skipped or marked
as an expected failure, so a run that measured nothing cannot pass for one that
found the defect gone. The ids (L2, L11, …) are the audit's; the frontend half
is app/src/audit/open-defects.test.js.
"""

import pytest
from pydantic import ValidationError

from backend.models.re_state import REElement, RELogEntry, RERelation
from backend.services.rethon_caps import rethon_arguments
from backend.services.rethon_tasks import build_numerical_arguments


def _element(id: str, type: str, status: str = "active", **fields) -> REElement:
    return REElement(
        **{
            "id": id,
            "type": type,
            "status": status,
            "confidence": 0.67,
            "text": id,
            "addedRound": 1,
            **fields,
        }
    )


def _relation(from_id: str, to_id: str, type: str, **fields) -> RERelation:
    return RERelation(
        **{"from": from_id, "to": to_id, "type": type, "addedRound": 1, **fields}
    )


# ── L2 · What the app writes when a suggestion is rejected at step 0 ───────────
#
# `handleRejectElements` and `handleRejectRelations` take no step, so in a new
# process the rejected item and its log entry are stamped 0. Every assist
# request sends the elements, and the judgments one the log.


@pytest.mark.parametrize(
    "field", ["addedRound", "rejectedRound"], ids=["added at 0", "rejected at 0"]
)
def test_L2_an_element_stamped_step_0_is_refused(field):
    # Fixed when the frontend stops writing 0 (then delete this), or when the
    # model takes it, as REState.round does "from 0: a new process has taken no
    # step yet" (then this must not raise).
    with pytest.raises(ValidationError):
        _element("J1", "judgment", "rejected", **{field: 0})


def test_L2_a_log_entry_at_step_0_is_refused():
    with pytest.raises(ValidationError):
        RELogEntry(round=0, decision="Rejected")


# ── L11 · Superseded links are the client's to leave out ───────────────────────


def test_L11_a_superseded_link_sent_to_the_server_is_an_argument():
    # `rethon_arguments` says a replaced argument "is the record of a position,
    # not an argument" and relies on the frontend dropping it (`presentState`).
    # Fixed when the server leaves it out itself: this then has one argument.
    relations = [
        _relation(
            "P1", "J1", "entails", argumentId="old", status="withdrawn", supersededBy="new"
        ),
        _relation("P1", "J2", "entails", argumentId="new"),
    ]
    assert len(rethon_arguments(relations)) == 2


# ── L12 · One argumentId, two arguments ────────────────────────────────────────


def test_L12_links_sharing_an_id_are_one_argument_whatever_they_conclude():
    # Reachable from an imported file only (validateState does not check it,
    # L4). Two links with one id, different conclusions and different types,
    # are read as the first one's argument: here "P1 and J2 jointly entail J1",
    # which neither link says.
    elements = [
        _element("J1", "judgment"),
        _element("J2", "judgment"),
        _element("P1", "principle"),
    ]
    relations = [
        _relation("P1", "J1", "jointly_entails", argumentId="a"),
        _relation("J2", "P1", "jointly_precludes", argumentId="a"),
    ]
    # Fixed when such a group is refused or split: not [[3, 2, 1]].
    assert build_numerical_arguments(elements, relations).num_arguments == [[3, 2, 1]]
