"""Router-level guarantees for the background theory endpoint.

What makes a good suggestion here is asked for in the prompt and none of it can
be checked mechanically — a suggestion is a theory and its references, with
nothing about how it relates to the elements already in the state. So these tests
are about what the endpoint refuses to pass on: a model-invented DOI, an
unrenderable reference, a theory with no text. And about the empty source list
being a permitted answer rather than a defect, which is the clause most likely to
be "tidied" into a requirement later.
"""

import json

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_llm_service
from backend.main import app
from backend.services import crossref
from backend.services.crossref import Verdict
from backend.services.llm import CompletionResult, LLMConfig, LLMService


class StubLLM(LLMService):
    """An LLMService that returns canned text without any network call."""

    def __init__(self, text):
        super().__init__(LLMConfig("k", "https://api.openai.com/v1", "stub-model"))
        self._text = text

    async def complete_with_usage(self, *args, **kwargs):
        return CompletionResult(text=self._text, input_tokens=3, output_tokens=7)


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Crossref off by default: these tests are about the router, not the check.

    The two tests that care about verification patch over this.
    """

    async def unchecked(sources, settings):
        return [Verdict("unchecked")] * len(sources)

    monkeypatch.setattr("backend.routers.theories.verify", unchecked)
    crossref._cache.clear()


@pytest.fixture
def llm_client():
    def build(text):
        app.dependency_overrides[get_llm_service] = lambda: StubLLM(text)
        return TestClient(app)

    yield build
    app.dependency_overrides.clear()


BOOK = {
    "type": "book",
    "authors": ["Parfit, D."],
    "year": "1984",
    "title": "Reasons and persons",
    "container": "",
    "editors": [],
    "publisher": "Oxford University Press",
    "volume": "",
    "issue": "",
    "pages": "",
}


def suggestion(**overrides):
    return {
        "text": "Personal identity consists in psychological continuity.",
        "sources": [BOOK],
        **overrides,
    }


def reply(*suggestions):
    return json.dumps({"suggestions": list(suggestions) or [suggestion()]})


def request_body(**overrides):
    return {
        "topic": "Autonomy and paternalism",
        "elements": [
            {
                "id": "J1",
                "type": "judgment",
                "status": "active",
                "confidence": 0.67,
                "text": "Locking someone in for their own good is wrong.",
                "addedRound": 1,
                "origin": "user",
            },
            {
                "id": "P1",
                "type": "principle",
                "status": "active",
                "confidence": 0.67,
                "text": "Respect competent refusal of treatment.",
                "addedRound": 1,
                "origin": "user",
            },
            {
                "id": "P2",
                "type": "principle",
                "status": "withdrawn",
                "confidence": 0.33,
                "text": "Never override a stated preference.",
                "addedRound": 1,
                "origin": "user",
            },
        ],
        **overrides,
    }


def post(client, body=None):
    return client.post("/api/theories/suggest", json=body or request_body())


# ── The happy path ────────────────────────────────────────────────────────────


def test_a_suggestion_reaches_the_response_intact(llm_client):
    response = post(llm_client(reply()))
    assert response.status_code == 200
    [got] = response.json()["suggestions"]
    assert got["text"].startswith("Personal identity")
    assert got["sources"][0]["title"] == "Reasons and persons"
    assert "bearings" not in got, (
        "relations to existing elements are the relations step's business; a "
        "theory arriving pre-annotated would duplicate it"
    )
    assert response.json()["model"] == "stub-model"


def test_confidence_is_the_apps_whatever_the_model_said(llm_client):
    """How strongly an element is held is the user's to set, never the model's."""
    response = post(llm_client(reply(suggestion(confidence=0.99))))
    assert response.json()["suggestions"][0]["confidence"] == 0.67


# ── What the endpoint refuses to pass on ──────────────────────────────────────


def test_a_model_supplied_doi_is_discarded(llm_client):
    """The schema gives a model nowhere to put one; plain JSON mode does not bind it.

    A DOI is the field a model fabricates most readily, and a wrong one fails
    quietly by resolving to a real but different work. Only Crossref's may appear.
    """
    cited = dict(BOOK, doi="10.9999/invented")
    response = post(llm_client(reply(suggestion(sources=[cited]))))
    assert response.json()["suggestions"][0]["sources"][0]["doi"] == ""


def test_a_theory_with_no_text_is_dropped(llm_client):
    assert post(llm_client(reply(suggestion(text="   ")))).json()["suggestions"] == []


@pytest.mark.parametrize(
    "broken, why",
    [
        ({"publisher": ""}, "a book with no publisher"),
        ({"type": "article", "container": ""}, "an article with no journal"),
        ({"type": "chapter"}, "a chapter with no containing volume"),
        ({"authors": []}, "a work with no author"),
        ({"title": ""}, "a work with no title"),
        ({"type": "webpage"}, "a type the formatter cannot render"),
    ],
)
def test_an_unusable_source_is_dropped_but_its_theory_survives(llm_client, broken, why):
    """A half-citation can be neither rendered nor looked up.

    Dropping the source rather than the suggestion: the theory may well be worth
    proposing, and an uncited theory is an outcome this design explicitly permits.
    """
    body = suggestion(sources=[dict(BOOK, **broken)])
    [got] = post(llm_client(reply(body))).json()["suggestions"]
    assert got["sources"] == [], why
    assert got["text"], "the theory itself must survive"


# ── The empty list is an answer, not a defect ─────────────────────────────────


def test_a_theory_with_no_sources_is_kept(llm_client):
    """Requiring a citation per suggestion is how fabricated citations are produced.

    Some background theories — "persons persist over time in some meaningful
    sense" — are common property that no single work owns.
    """
    [got] = post(llm_client(reply(suggestion(sources=[])))).json()["suggestions"]
    assert got["sources"] == []
    assert got["text"], "an uncited theory is a permitted outcome"


def test_no_suggestions_at_all_is_a_200(llm_client):
    response = post(llm_client(json.dumps({"suggestions": []})))
    assert response.status_code == 200
    assert response.json()["suggestions"] == []


# ── Verification ──────────────────────────────────────────────────────────────


def test_a_verified_source_carries_crossrefs_doi(llm_client, monkeypatch):
    async def matched(sources, settings):
        return [Verdict("matched", "10.1093/019824908x.001.0001")] * len(sources)

    monkeypatch.setattr("backend.routers.theories.verify", matched)
    [got] = post(llm_client(reply())).json()["suggestions"]
    assert got["sources"][0]["verification"] == "matched"
    assert got["sources"][0]["doi"] == "10.1093/019824908x.001.0001"


def test_a_crossref_outage_still_returns_the_suggestions(llm_client, monkeypatch):
    """Verification decorates a suggestion; it must not be able to fail one."""

    async def down(sources, settings):
        return [Verdict("unchecked")] * len(sources)

    monkeypatch.setattr("backend.routers.theories.verify", down)
    response = post(llm_client(reply()))
    assert response.status_code == 200
    assert (
        response.json()["suggestions"][0]["sources"][0]["verification"] == "unchecked"
    )


def test_verdicts_line_up_with_sources_across_suggestions(llm_client, monkeypatch):
    """Sources are checked in one flattened batch, so their order is load-bearing."""
    other = dict(BOOK, title="On what matters")

    async def by_title(sources, settings):
        return [
            Verdict("matched", "10.1/" + s.title.split()[0].lower()) for s in sources
        ]

    monkeypatch.setattr("backend.routers.theories.verify", by_title)
    got = post(
        llm_client(
            reply(
                suggestion(sources=[BOOK]),
                suggestion(text="A second theory.", sources=[other]),
            )
        )
    ).json()["suggestions"]
    assert got[0]["sources"][0]["doi"] == "10.1/reasons"
    assert got[1]["sources"][0]["doi"] == "10.1/on"


# ── Upstream failure ──────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "text, why",
    [
        ("not json at all", "unparseable"),
        ('[{"text": "a theory"}]', "a bare array where an object was required"),
    ],
)
def test_an_unusable_reply_is_a_502(llm_client, text, why):
    """The upstream model failed us; the request was not wrong."""
    assert post(llm_client(text)).status_code == 502, why
