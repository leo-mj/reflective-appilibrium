"""Tests for the propositional validity checker and the verification pipeline."""

import pytest

from backend.services.argument_checker import (
    FormParseError,
    entails,
    parse_form,
    verify_argument,
)
from backend.services.arguments import verify_and_partition
from backend.routers.arguments_schemas import AddedPremise


# ── Parser ────────────────────────────────────────────────────────────────────


def test_parse_sentence_and_negation():
    assert parse_form("14") == ("sentence", 14)
    assert parse_form("~3") == ("not", ("sentence", 3))
    assert parse_form("-3") == ("not", ("sentence", 3))


def test_parse_precedence_and_to_imp():
    # "1 & 2 -> 3" parses as (1 & 2) -> 3
    assert parse_form("1 & 2 -> 3") == (
        "imp",
        ("and", ("sentence", 1), ("sentence", 2)),
        ("sentence", 3),
    )


def test_parse_implication_right_associative():
    assert parse_form("1 -> 2 -> 3") == (
        "imp",
        ("sentence", 1),
        ("imp", ("sentence", 2), ("sentence", 3)),
    )


def test_parse_parentheses():
    assert parse_form("(14 & 22) -> 1") == (
        "imp",
        ("and", ("sentence", 14), ("sentence", 22)),
        ("sentence", 1),
    )


def test_parse_disjunction():
    assert parse_form("1 | 2") == ("or", ("sentence", 1), ("sentence", 2))


def test_parse_precedence_and_before_or():
    # "1 & 2 | 3" parses as (1 & 2) | 3
    assert parse_form("1 & 2 | 3") == (
        "or",
        ("and", ("sentence", 1), ("sentence", 2)),
        ("sentence", 3),
    )


def test_parse_precedence_or_before_imp():
    # "1 | 2 -> 3" parses as (1 | 2) -> 3
    assert parse_form("1 | 2 -> 3") == (
        "imp",
        ("or", ("sentence", 1), ("sentence", 2)),
        ("sentence", 3),
    )


def test_parse_negation_binds_tighter_than_and():
    # "~1 & 2" parses as (~1) & 2, not ~(1 & 2)
    assert parse_form("~1 & 2") == (
        "and",
        ("not", ("sentence", 1)),
        ("sentence", 2),
    )


def test_parse_double_negation():
    assert parse_form("~~3") == ("not", ("not", ("sentence", 3)))
    assert parse_form("-~3") == ("not", ("not", ("sentence", 3)))


def test_parse_whitespace_insensitive():
    assert parse_form(" ( 3&4 )->7 ") == parse_form("(3 & 4) -> 7")


def test_parse_errors():
    for bad in ["", "1 &", "-> 2", "(1", "1 ? 2", "0 -> 1", "1 2", "(1)(2)"]:
        with pytest.raises(FormParseError):
            parse_form(bad)


# ── Entailment ────────────────────────────────────────────────────────────────


def test_modus_ponens():
    assert entails([("sentence", 1), parse_form("1 -> 2")], ("sentence", 2))


def test_sentences_do_not_entail_other_sentences():
    assert not entails([("sentence", 1), ("sentence", 2)], ("sentence", 3))


def test_modus_tollens_with_negated_premise():
    # ¬2, (1 -> 2) ⊨ ¬1
    assert entails(
        [("not", ("sentence", 2)), parse_form("1 -> 2")], ("not", ("sentence", 1))
    )


def test_disjunctive_syllogism():
    # (1 ∨ 2), ¬1 ⊨ 2
    assert entails([parse_form("1 | 2"), ("not", ("sentence", 1))], ("sentence", 2))


def test_hypothetical_syllogism():
    # (1 → 2), (2 → 3) ⊨ (1 → 3)
    assert entails([parse_form("1 -> 2"), parse_form("2 -> 3")], parse_form("1 -> 3"))


def test_affirming_the_consequent_not_valid():
    # 2, (1 → 2) ⊭ 1 — the classic formal fallacy must be rejected
    assert not entails([("sentence", 2), parse_form("1 -> 2")], ("sentence", 1))


def test_denying_the_antecedent_not_valid():
    # ¬1, (1 → 2) ⊭ ¬2
    assert not entails(
        [("not", ("sentence", 1)), parse_form("1 -> 2")], ("not", ("sentence", 2))
    )


# ── verify_argument ───────────────────────────────────────────────────────────


def test_valid_bridged_argument():
    result = verify_argument([14, 30, 1], {30: "14 -> 1"})
    assert result.accepted and result.argument == [14, 30, 1]


def test_two_pool_premises_with_bridge():
    result = verify_argument([14, 22, 30, 1], {30: "(14 & 22) -> 1"})
    assert result.accepted and result.argument == [14, 22, 30, 1]


def test_self_referential_form_rejected():
    result = verify_argument([14, 22, 1], {22: "(14 & 22) -> 1"})
    assert not result.accepted and "own index" in result.reason


def test_bare_sentences_argument_rejected():
    result = verify_argument([14, 1], {})
    assert not result.accepted and "not formally valid" in result.reason


def test_conclusion_among_premises_rejected():
    result = verify_argument([3, 4, 3], {})
    assert not result.accepted and "conclusion" in result.reason


def test_ex_falso_rejected():
    result = verify_argument([3, -3, 7], {})
    assert not result.accepted and "inconsistent" in result.reason


def test_negated_conclusion():
    # P4 + bridge → ¬P2 pattern: {17, 17 -> ~15} ⊨ ¬15
    result = verify_argument([17, 30, -15], {30: "17 -> ~15"})
    assert result.accepted


def test_auto_trim_redundant_premise():
    # Premise 4 contributes nothing: {3, 3 -> 1} ⊨ 1
    result = verify_argument([3, 30, 4, 1], {30: "3 -> 1"})
    assert result.accepted and result.argument == [3, 30, 1]


def test_unparseable_form_rejects_argument():
    result = verify_argument([3, 30, 1], {30: "3 -> "})
    assert not result.accepted and "unparseable" in result.reason


def test_malformed_form_of_unused_premise_does_not_poison_argument():
    # Premise 31's broken form is irrelevant to an argument that only uses 30.
    result = verify_argument([14, 30, 1], {30: "14 -> 1", 31: "((("})
    assert result.accepted


def test_negated_pool_premise():
    # ¬3, (¬3 → 7) ⊨ 7
    result = verify_argument([-3, 30, 7], {30: "~3 -> 7"})
    assert result.accepted


def test_minimal_circular_argument_rejected():
    result = verify_argument([3, 3], {})
    assert not result.accepted and "circular" in result.reason


def test_ex_falso_detected_through_forms():
    # Premise 30's form ¬3 contradicts pool premise 3 — inconsistency is
    # visible only once forms are substituted.
    result = verify_argument([3, 30, 7], {30: "~3"})
    assert not result.accepted and "ex falso" in result.reason


def test_auto_trim_multiple_redundant_premises():
    result = verify_argument([3, 4, 5, 30, 1], {30: "3 -> 1"})
    assert result.accepted and result.argument == [3, 30, 1]


def test_auto_trim_between_equivalent_bridges_keeps_one():
    # Two premises with identical forms: exactly one survives trimming.
    result = verify_argument([3, 30, 31, 1], {30: "3 -> 1", 31: "3 -> 1"})
    assert result.accepted
    assert len(result.argument) == 3 and result.argument[0] == 3


def test_form_exceeding_sentence_cap_rejected():
    big_form = " & ".join(str(i) for i in range(1, 18))  # 17 distinct sentences
    result = verify_argument([30, 18], {30: big_form})
    assert not result.accepted and "too large" in result.reason


# ── verify_and_partition ──────────────────────────────────────────────────────


def _premise(index, form, role, text=None):
    return AddedPremise(
        index=index,
        type="principle",
        text=text or f"Added premise {index}.",
        form=form,
        role=role,
    )


def test_postulate_stripped_from_argument():
    premises = [_premise(30, "16 -> 10", "postulate", "Meaning link 16→10.")]
    kept, postulates, used, rejected = verify_and_partition([[16, 30, 10]], premises)
    assert kept == [[16, 10]]
    assert postulates == [["Meaning link 16→10."]]
    assert used == [] and rejected == 0


def test_substantive_premise_kept_in_argument():
    premises = [_premise(30, "14 -> 1", "premise")]
    kept, postulates, used, rejected = verify_and_partition([[14, 30, 1]], premises)
    assert kept == [[14, 30, 1]]
    assert postulates == [[]]
    assert [p.index for p in used] == [30] and rejected == 0


def test_argument_resting_on_postulates_alone_rejected():
    premises = [_premise(30, "10", "postulate")]
    kept, _, _, rejected = verify_and_partition([[30, 10]], premises)
    assert kept == [] and rejected == 1


def test_invalid_argument_counted():
    premises = [_premise(30, "14 -> 1", "premise")]
    kept, _, _, rejected = verify_and_partition([[14, 30, 1], [14, 2]], premises)
    assert kept == [[14, 30, 1]] and rejected == 1


def test_unused_premises_not_returned():
    premises = [
        _premise(30, "14 -> 1", "premise"),
        _premise(31, "2 -> 3", "premise"),
    ]
    _, _, used, _ = verify_and_partition([[14, 30, 1]], premises)
    assert [p.index for p in used] == [30]


def test_mixed_roles_chained_argument():
    # 3 + substantive bridge (3→4) + postulate (4→7) ⊨ 7: the postulate is
    # stripped from the surfaced argument, the substantive premise stays.
    premises = [
        _premise(30, "3 -> 4", "premise"),
        _premise(31, "4 -> 7", "postulate", "Meaning link 4→7."),
    ]
    kept, postulates, used, rejected = verify_and_partition([[3, 30, 31, 7]], premises)
    assert kept == [[3, 30, 7]]
    assert postulates == [["Meaning link 4→7."]]
    assert [p.index for p in used] == [30] and rejected == 0


def test_interchangeable_postulate_dropped_in_favor_of_premise():
    # A postulate and a substantive premise with identical content: the trim
    # must drop the postulate and keep the substantive premise, so the
    # contestable commitment stays visible as a rejectable element (the
    # "when in doubt, premise" asymmetry).
    premises = [
        _premise(30, "3 -> 1", "premise"),
        _premise(31, "3 -> 1", "postulate", "Redundant meaning link."),
    ]
    kept, postulates, used, _ = verify_and_partition([[3, 30, 31, 1]], premises)
    assert kept == [[3, 30, 1]]
    assert postulates == [[]]
    assert [p.index for p in used] == [30]


def test_empty_input():
    assert verify_and_partition([], []) == ([], [], [], 0)
