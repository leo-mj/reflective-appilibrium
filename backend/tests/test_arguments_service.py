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
