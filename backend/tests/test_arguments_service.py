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


def test_prompt_types_empirical_premises_as_background_theories():
    # The simulation's theory is principles and theories only, and rethon's
    # account asks what the theory alone implies: an empirical premise typed as
    # a judgment would leave every argument resting on it unable to count.
    prompt = build_prompt(LOOKUP, [])
    assert 'EVERY empirical premise is a "theory"' in prompt
    assert 'Never type an empirical claim as a "judgment"' in prompt


def test_prompt_added_premise_numbering_follows_pool():
    prompt = build_prompt(LOOKUP, [])
    assert "starting at 5" in prompt and '"index": 5' in prompt


def test_prompt_omits_topic_line_when_blank():
    prompt = build_prompt(LOOKUP, [])
    assert "reflective-equilibrium analysis of the topic" not in prompt


# ── Resilient added-premise parsing ───────────────────────────────────────────


def test_parse_added_premises_keeps_valid_entries():
    from backend.services.arguments import parse_added_premises

    raw = [
        {"index": 5, "type": "principle", "text": "a", "form": "1 -> 5"},
        {"index": 6, "type": "judgment", "text": "b", "role": "postulate"},
    ]
    premises = parse_added_premises(raw)
    assert [p.index for p in premises] == [5, 6]
    assert premises[1].role == "postulate"


def test_parse_added_premises_drops_type_postulate_entry():
    from backend.services.arguments import parse_added_premises

    # The LLM put "postulate" in `type` (not a valid element type) instead of
    # `role`.  That one entry is dropped; the well-formed entry survives.
    raw = [
        {"index": 5, "type": "postulate", "text": "bad", "form": "1 -> 5"},
        {"index": 6, "type": "principle", "text": "good", "form": "1 -> 6"},
    ]
    premises = parse_added_premises(raw)
    assert [p.index for p in premises] == [6]


def test_parse_added_premises_tolerates_non_list_payload():
    from backend.services.arguments import parse_added_premises

    assert parse_added_premises(None) == []
    assert parse_added_premises({"index": 5}) == []


# ── Sample fixture (dummy path) ───────────────────────────────────────────────


def _sample_state_elements():
    """Element list matching the sample state's order: J1–J13, P1–P6, T1, T2, J14.

    J14 (index 22) is the premise promoted into the state; P1 + J14 → J1 is
    detected over existing elements rather than via an added premise. The
    frontend demo has since retyped it as a background theory, T3; the
    position, which is all the dummy detection reads, is unchanged.
    """
    specs = (
        [(f"J{i}", "judgment") for i in range(1, 14)]
        + [(f"P{i}", "principle") for i in range(1, 7)]
        + [("T1", "theory"), ("T2", "theory"), ("J14", "judgment")]
    )
    return [_element(eid, etype, f"Sample sentence {eid}.") for eid, etype in specs]


def test_sample_fixture_passes_the_checker():
    from backend.services.arguments import dummy_detect_arguments

    response = dummy_detect_arguments(_sample_state_elements(), "8")
    # Every fixture argument must pass the checker untrimmed.
    assert response.dropped_count == 0
    assert response.argument_failures == [None] * 15
    # The response names the (sample) generating model, mirroring live output so
    # the UI's AI-disclosure banner can show it.
    assert response.model == "claude-fable-5"
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


# ── partition_arguments: checker-disabled passthrough ─────────────────────────


def test_partition_verify_true_delegates_to_checker():
    from backend.services.arguments import partition_arguments
    from backend.routers.arguments_schemas import AddedPremise

    # The bridge premise 3 has the form "1 -> 3", which names its own index —
    # so the checker cannot read it, and says so rather than dropping it.
    premises = [AddedPremise(index=3, type="principle", text="bridge", form="1 -> 3")]
    out = partition_arguments([[1, 3, 2]], premises, verify=True, pool_indices={1, 2})
    assert out.arguments == [[1, 3, 2]]
    assert [f.code for f in out.failures] == ["self_reference"]
    assert out.dropped == 0


def test_partition_verify_false_surfaces_invalid_arguments():
    from backend.services.arguments import partition_arguments
    from backend.routers.arguments_schemas import AddedPremise

    # Formally invalid: sentence 1 does not entail sentence 2. With the checker
    # off it is surfaced as-is, untagged: nothing checked it.
    premises = [AddedPremise(index=3, type="principle", text="p", role="postulate")]
    out = partition_arguments([[1, 2]], premises, verify=False, pool_indices={1, 2})
    assert out.arguments == [[1, 2]]
    assert out.failures == [None]
    assert out.dropped == 0
    # No postulate stripping: every argument reports an empty postulate list...
    assert out.postulates == [[]]
    # ...and every added premise (postulate included) is kept for the pool.
    assert out.premises == premises


def test_partition_verify_false_drops_unknown_indices():
    from backend.services.arguments import partition_arguments

    # Index 9 is neither a pool sentence nor an added premise, so the argument
    # is dropped to keep translations resolvable; the clean one survives and
    # the drop is counted.
    out = partition_arguments(
        [[1, 9, 2], [1, 2]], [], verify=False, pool_indices={1, 2}
    )
    assert out.arguments == [[1, 2]]
    assert out.dropped == 1


def test_partition_verify_true_drops_args_on_discarded_premises():
    from backend.services.arguments import partition_arguments, parse_added_premises

    # The LLM proposed a premise at index 3 but mislabelled its type, so it is
    # discarded by parse_added_premises.  The argument that leaned on index 3 is
    # unresolvable and must be dropped outright (not handed to the checker as a
    # bare atom, which risks a lookup KeyError); the pool-only argument is left
    # for the checker to judge.
    premises = parse_added_premises(
        [{"index": 3, "type": "postulate", "text": "bridge", "form": "1 -> 3"}]
    )
    assert premises == []
    out = partition_arguments(
        [[1, 3, 2], [1, 2]], premises, verify=True, pool_indices={1, 2}
    )
    assert out.arguments == [[1, 2]]
    assert [f.code for f in out.failures] == ["invalid"]
    assert out.dropped == 1


# ── Repeated premises and restating postulates ────────────────────────────────

NON_IDENTITY = (
    "The non-identity problem shows that specific future individuals are "
    "metaphysically indeterminate, but future people as a class are not."
)
OBLIGATION = (
    "Yes, we have moral obligations to future people as a class, even if "
    "specific individuals are indeterminate."
)
POOL_TEXTS = {1: NON_IDENTITY, 2: OBLIGATION, 3: "Unrelated sentence."}


def _premise(index, text, role="premise", form=None, etype="principle"):
    from backend.routers.arguments_schemas import AddedPremise

    return AddedPremise(index=index, type=etype, text=text, role=role, form=form)


def test_the_reported_argument_is_tagged_as_a_restatement():
    # As a model returned it: premise 4 copies sentence 1 word for word, and
    # the postulate is "If <1>, then <2>". It surfaced as 1 + 4 → 2, valid
    # given the bare conditional, with the same claim shown twice.
    from backend.services.arguments import partition_arguments

    premises = [
        _premise(4, NON_IDENTITY.lower()),
        _premise(
            5,
            f"If {NON_IDENTITY[:-1].lower()}, then {OBLIGATION[0].lower()}{OBLIGATION[1:]}",
            role="postulate",
            form="(1 & 4) -> 2",
        ),
    ]
    out = partition_arguments(
        [[1, 4, 5, 2]],
        premises,
        verify=True,
        pool_indices={1, 2, 3},
        pool_texts=POOL_TEXTS,
    )
    # The copy is read as sentence 1, and the bridge is shown as a premise,
    # tagged, rather than folded away as "Valid given".
    assert out.arguments == [[1, 5, 2]]
    assert [f.code for f in out.failures] == ["restatement"]
    assert [p.index for p in out.premises] == [5]


def test_a_repeated_premise_is_read_as_the_sentence_it_repeats():
    from backend.services.arguments import identify_repeated_premises

    args, premises = identify_repeated_premises(
        [[1, 4, 5, 2], [3, -4, 2]],
        [
            _premise(4, f"  {NON_IDENTITY.upper()} "),
            _premise(5, "A bridge.", role="postulate", form="(1 & 4) -> 2"),
        ],
        POOL_TEXTS,
    )
    assert args == [[1, 5, 2], [3, -1, 2]]
    assert [p.index for p in premises] == [5]
    assert premises[0].form == "(1 & 1) -> 2"


def test_a_premise_repeating_the_conclusion_makes_the_argument_circular():
    from backend.services.arguments import partition_arguments

    premises = [
        _premise(4, OBLIGATION),
        _premise(5, "A bridge.", role="postulate", form="(1 & 4) -> 2"),
    ]
    out = partition_arguments(
        [[1, 4, 5, 2]],
        premises,
        verify=True,
        pool_indices={1, 2, 3},
        pool_texts=POOL_TEXTS,
    )
    assert [f.code for f in out.failures] == ["circular"]
    # Shown as proposed, the copy read as the conclusion it repeats.
    assert out.arguments == [[1, 2, 5, 2]]


def test_two_added_premises_with_one_wording_are_one_premise():
    from backend.services.arguments import identify_repeated_premises

    args, premises = identify_repeated_premises(
        [[1, 4, 5, 2]],
        [_premise(4, "A new claim."), _premise(5, "a new claim")],
        POOL_TEXTS,
    )
    assert args == [[1, 4, 2]]
    assert [p.index for p in premises] == [4]


def test_a_paraphrasing_postulate_still_licenses_the_step():
    # The shape of every sample postulate: the same form, in other words.
    from backend.services.arguments import partition_arguments

    premises = [
        _premise(
            4,
            "Obligations can attach de dicto to whoever will exist.",
        ),
        _premise(
            5,
            "If obligations attach de dicto, an indeterminate class of future "
            "people can still be owed them.",
            role="postulate",
            form="(1 & 4) -> 2",
        ),
    ]
    out = partition_arguments(
        [[1, 4, 5, 2]],
        premises,
        verify=True,
        pool_indices={1, 2, 3},
        pool_texts=POOL_TEXTS,
    )
    assert out.arguments == [[1, 4, 2]]
    assert out.failures == [None]
    assert [p.index for p in out.premises] == [4]


def test_restates_inference_needs_every_sentence_quoted_whole():
    from backend.services.arguments import restates_inference

    texts = {1: "Lying is wrong.", 2: "Lying to the murderer is wrong."}
    bare = _premise(
        5,
        "If lying is wrong, then lying to the murderer is wrong.",
        role="postulate",
        form="1 -> 2",
    )
    assert restates_inference(bare, texts)
    # One sentence quoted, the other paraphrased.
    half = _premise(
        5,
        "If lying is wrong, then so is deceiving a murderer.",
        role="postulate",
        form="1 -> 2",
    )
    assert not restates_inference(half, texts)
    # A quote inside a longer word is no quote.
    inside = _premise(
        5,
        "Belying is wrong, so lying to the murderer is wrong.",
        role="postulate",
        form="1 -> 2",
    )
    assert not restates_inference(inside, {**texts, 1: "Lying is wrong."})
    # A sentence the texts do not hold cannot be found quoted.
    unknown = _premise(
        5,
        "If lying is wrong, then lying to the murderer is wrong.",
        role="postulate",
        form="1 -> 9",
    )
    assert not restates_inference(unknown, texts)


def test_the_prompt_forbids_repeating_a_sentence():
    assert "Never add a premise that repeats a pool sentence" in build_prompt(LOOKUP)


def test_the_prompt_example_passes_the_checker():
    # The model copies the example's shapes, so the example has to be one the
    # checker accepts in full.
    import json
    from backend.services.arguments import parse_added_premises, partition_arguments

    prompt = build_prompt(LOOKUP)
    start = prompt.index("in exactly this format:\n") + len("in exactly this format:\n")
    example = json.loads(prompt[start : prompt.index("\n\nIf no substantive")])
    out = partition_arguments(
        example["arguments"],
        parse_added_premises(example["added_premises"]),
        verify=True,
        pool_indices=LOOKUP.keys(),
        pool_texts={n: e.text for n, e in LOOKUP.items()},
    )
    assert out.failures == [None] * len(example["arguments"])
    assert out.dropped == 0
    assert all(len(p) == 1 for p in out.postulates)


def test_the_prompt_spells_out_the_bookkeeping():
    prompt = build_prompt(LOOKUP)
    assert "Write it as the bridge" in prompt
    assert "Before answering, check every argument" in prompt
