"""Tests for argument dedup fingerprints, the skip-list formatter, and the prompt builder."""

from backend.models.re_state import REElement, RERelation
from backend.services.arguments import (
    build_prompt,
    existing_arg_fingerprints,
    format_existing_args_for_prompt,
)


def _element(eid, etype, text):
    return REElement(
        id=eid,
        type=etype,
        status="active",
        confidence=1.0,
        origin="user",
        text=text,
        addedRound=1,
    )


def _relation(from_id, to_id, rtype, argument_id):
    return RERelation(
        **{
            "from": from_id,
            "to": to_id,
            "type": rtype,
            "explanation": "x",
            "addedRound": 1,
            "argumentId": argument_id,
        }
    )


ELEMENTS = [
    _element("J1", "judgment", "First judgment."),
    _element("J2", "judgment", "Second judgment."),
    _element("P1", "principle", "First principle."),
    _element("T1", "theory", "First theory."),
]
LOOKUP = {i + 1: e for i, e in enumerate(ELEMENTS)}
REVERSE = {e.id: n for n, e in LOOKUP.items()}


# ── Fingerprints: single-premise and precludes coverage ───────────────────────


def test_single_premise_entails_fingerprinted():
    rels = [_relation("P1", "J1", "entails", "arg-1")]
    assert existing_arg_fingerprints(rels, REVERSE) == {((3,), 1)}


def test_single_premise_precludes_negates_conclusion():
    rels = [_relation("P1", "J1", "precludes", "arg-1")]
    assert existing_arg_fingerprints(rels, REVERSE) == {((3,), -1)}


def test_jointly_precludes_negates_conclusion():
    rels = [
        _relation("P1", "J2", "jointly_precludes", "arg-1"),
        _relation("J1", "J2", "jointly_precludes", "arg-1"),
    ]
    assert existing_arg_fingerprints(rels, REVERSE) == {((1, 3), -2)}


def test_non_argument_relations_ignored():
    rels = [_relation("P1", "J1", "supports", None)]
    assert existing_arg_fingerprints(rels, REVERSE) == set()


# ── Skip-list formatter ───────────────────────────────────────────────────────


def test_skip_list_includes_singles_and_negation_marker():
    rels = [
        _relation("P1", "J1", "precludes", "arg-1"),
        _relation("T1", "J2", "entails", "arg-2"),
    ]
    formatted = format_existing_args_for_prompt(rels, REVERSE)
    assert "¬J1" in formatted and "[3, -1]" in formatted
    assert "→ J2" in formatted and "[4, 2]" in formatted


# ── Prompt builder ────────────────────────────────────────────────────────────


def test_prompt_contains_types_topic_and_roles():
    prompt = build_prompt(LOOKUP, [], topic="Test topic")
    assert "[judgment]" in prompt and "[principle]" in prompt and "[theory]" in prompt
    assert '"Test topic"' in prompt
    assert '"postulate"' in prompt and '"premise"' in prompt
    assert "meaning postulate" in prompt
    assert '"form"' in prompt
    assert "STRICTLY FORMALLY VALID" in prompt


def test_prompt_added_premise_numbering_follows_pool():
    prompt = build_prompt(LOOKUP, [])
    assert "starting at 5" in prompt and '"index": 5' in prompt


def test_prompt_omits_topic_line_when_blank():
    prompt = build_prompt(LOOKUP, [])
    assert "reflective-equilibrium analysis of the topic" not in prompt


# ── Sample fixture (dummy path) ───────────────────────────────────────────────


def _sample_state_elements():
    """Element list matching the sample state's order: J1–J13, P1–P6, T1, T2."""
    specs = (
        [(f"J{i}", "judgment") for i in range(1, 14)]
        + [(f"P{i}", "principle") for i in range(1, 7)]
        + [("T1", "theory"), ("T2", "theory")]
    )
    return [_element(eid, etype, f"Sample sentence {eid}.") for eid, etype in specs]


def test_sample_fixture_verifies_with_zero_rejections():
    from backend.services.arguments import dummy_detect_arguments

    response = dummy_detect_arguments(_sample_state_elements(), "8")
    # Every fixture argument must survive formal verification untrimmed.
    assert response.rejected_count == 0
    assert len(response.num_arguments) == 15
    # Postulates are stripped from every surfaced argument and reported
    # separately — each fixture argument relies on exactly one postulate.
    assert all(len(post) == 1 for post in response.argument_postulates)
    postulate_indices = set(range(30, 45))
    for arg in response.num_arguments:
        assert not postulate_indices & {abs(n) for n in arg}
    # The surfaced forms match the frontend fixture's audited argument list.
    assert response.num_arguments[0] == [14, 22, 1]
    assert [17, 26, -1] in response.num_arguments
    assert [13, 29, 26, -8] in response.num_arguments


def test_sample_fixture_dedups_against_state_arguments():
    from backend.services.arguments import dummy_detect_arguments

    elements = _sample_state_elements()
    # arg-sample-1 (T1 + T2 → P2) already recorded in the state.
    rels = [
        _relation("T1", "P2", "jointly_entails", "arg-sample-1"),
        _relation("T2", "P2", "jointly_entails", "arg-sample-1"),
    ]
    response = dummy_detect_arguments(elements, "8", rels)
    assert len(response.num_arguments) == 14
    assert [20, 21, 15] not in response.num_arguments


def test_sample_fixture_skips_arguments_for_truncated_states():
    from backend.services.arguments import dummy_detect_arguments

    # Only the first 12 elements (no J13, no principles/theories): every
    # argument references a missing element, so none survive — and none crash.
    response = dummy_detect_arguments(_sample_state_elements()[:12], "3")
    assert response.num_arguments == []
