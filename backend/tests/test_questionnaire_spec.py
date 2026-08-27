"""Validation of ``REState.questionnaireSpec``.

This field used to be typed ``Any``. Every other field on the state is
size-capped, so it was both the one part of a saved session that reached disk
unchecked and the way to make the session store write a file of arbitrary size.

The bounds mirror ``validateQuestionnaireSpec`` in
app/src/utils/importMarkdown.js. Where they disagree, a spec that the frontend
accepts would be rejected on save (or the reverse), and a questionnaire session
would stop round-tripping — which is exactly how the 20-judgment cap went
unnoticed until a shipped spec outgrew it.
"""

import pytest
from pydantic import ValidationError

from backend.models.re_state import QuestionnaireSpec, REState


def spec(**overrides) -> dict:
    return {
        "id": "example",
        "name": "Example",
        "card": {"title": "T", "description": "D", "buttonLabel": "Start"},
        "suggestions": [
            {
                "question": "Q1?",
                "judgments": [
                    {
                        "index": 1,
                        "id": "J1",
                        "confidence": 0.67,
                        "answer": "Yes",
                        "text": "Some judgment",
                    }
                ],
            }
        ],
        "participantArguments": [[1, 2]],
        "furtherArguments": [],
        **overrides,
    }


def test_a_well_formed_spec_validates():
    parsed = QuestionnaireSpec.model_validate(spec())
    assert parsed.id == "example"
    assert parsed.participant_arguments == [[1, 2]]


def test_it_round_trips_through_a_state():
    state = REState.model_validate(
        {
            "topic": "t",
            "round": 1,
            "model": "questionnaire",
            "questionnaireSpec": spec(),
        }
    )
    dumped = state.model_dump(by_alias=True, exclude_none=True)
    assert dumped["questionnaireSpec"]["card"]["buttonLabel"] == "Start"


# ── Bounds ────────────────────────────────────────────────────────────────────


def test_a_hundred_judgments_are_allowed():
    """A shipped questionnaire has a question with 31 answers."""
    judgments = [
        {"index": i, "id": f"J{i}", "confidence": 0.5, "answer": "a", "text": "t"}
        for i in range(100)
    ]
    QuestionnaireSpec.model_validate(
        spec(suggestions=[{"question": "Q?", "judgments": judgments}])
    )


def test_more_than_a_hundred_judgments_are_rejected():
    judgments = [
        {"index": i, "id": f"J{i}", "confidence": 0.5, "answer": "a", "text": "t"}
        for i in range(101)
    ]
    with pytest.raises(ValidationError):
        QuestionnaireSpec.model_validate(
            spec(suggestions=[{"question": "Q?", "judgments": judgments}])
        )


@pytest.mark.parametrize(
    "overrides",
    [
        {"id": "x" * 101},
        {"name": "x" * 501},
        {"model": "x" * 101},
        {"suggestions": [{"question": "Q?", "judgments": []}] * 101},
        {"participantArguments": [[1]] * 101},
        {"furtherArguments": [[1]] * 101},
        {"participantArguments": [list(range(51))]},
        {"card": {"title": "x" * 501}},
        {"card": {"buttonLabel": "x" * 201}},
        {"card": {"description": "x" * 5_001}},
        {"card": {"description": ["x"] * 51}},
        {"card": {"description": ["x" * 2_001]}},
    ],
    ids=[
        "id",
        "name",
        "model",
        "suggestions",
        "participantArguments",
        "furtherArguments",
        "argument-length",
        "card-title",
        "card-button",
        "card-description-string",
        "card-description-list",
        "card-description-item",
    ],
)
def test_oversized_fields_are_rejected(overrides):
    with pytest.raises(ValidationError):
        QuestionnaireSpec.model_validate(spec(**overrides))


def test_a_giant_unknown_payload_no_longer_gets_through():
    """The shape that made an arbitrary-size write possible."""
    with pytest.raises(ValidationError):
        QuestionnaireSpec.model_validate(spec(junk="x" * 1_000_000))


def test_confidence_stays_within_zero_and_one():
    for bad in (-0.1, 1.1):
        with pytest.raises(ValidationError):
            QuestionnaireSpec.model_validate(
                spec(
                    suggestions=[
                        {
                            "question": "Q?",
                            "judgments": [
                                {
                                    "index": 1,
                                    "id": "J1",
                                    "confidence": bad,
                                    "answer": "a",
                                    "text": "t",
                                }
                            ],
                        }
                    ]
                )
            )


# ── Card description links ────────────────────────────────────────────────────


def test_a_description_may_mix_text_and_links():
    parsed = QuestionnaireSpec.model_validate(
        spec(
            card={
                "title": "T",
                "description": [
                    "Built with ",
                    {"link": "the framework", "href": "https://example.org/framework"},
                    ".",
                ],
                "buttonLabel": "Start",
            }
        )
    )
    assert parsed.card.description[1].href == "https://example.org/framework"


@pytest.mark.parametrize(
    "href",
    [
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        "data:text/html;base64,PHNjcmlwdD4=",
        "vbscript:msgbox(1)",
        "file:///etc/passwd",
    ],
)
def test_non_web_link_schemes_are_rejected(href):
    """A description is rendered into an anchor, so the href is a real target."""
    with pytest.raises(ValidationError):
        QuestionnaireSpec.model_validate(
            spec(card={"description": [{"link": "click", "href": href}]})
        )


@pytest.mark.parametrize(
    "href", ["http://example.com", "https://example.com/a?b=c", ""]
)
def test_web_links_and_empty_hrefs_are_accepted(href):
    QuestionnaireSpec.model_validate(
        spec(card={"description": [{"link": "x", "href": href}]})
    )
