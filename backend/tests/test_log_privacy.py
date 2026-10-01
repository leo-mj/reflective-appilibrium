"""The server's log is not a record of anyone's moral reasoning.

A hosted instance handles strangers' positions — their topics, judgments and
principles, and model replies that quote them back. None of it may reach a log
line. Each test here pushes a marked string through a path that used to log
content, or could, and fails if the marker comes out in what the backend's own
handler would have written, tracebacks included.

These are the failure paths on purpose. The happy paths log counts; it is the
error branches — an unparseable reply, a malformed premise, an unreachable
Crossref — where a log line reaches for the offending text to be useful.
"""

import json
import logging

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_llm_service
from backend.logging_setup import ContentFreeFormatter
from backend.main import app
from backend.models.re_state import RESource
from backend.services import crossref
from backend.services.llm import CompletionResult, LLMConfig, LLMService
from backend.tests.conftest import make_settings

MARK = "ZEBRA-MARKER-7741"


class StubLLM(LLMService):
    def __init__(self, text):
        super().__init__(LLMConfig("k", "https://api.openai.com/v1", "stub-model"))
        self._text = text

    async def complete_with_usage(self, *args, **kwargs):
        return CompletionResult(text=self._text, input_tokens=1, output_tokens=1)


@pytest.fixture
def backend_log():
    """What the backend's handler would print, formatter and all."""
    lines = []

    class Collect(logging.Handler):
        def emit(self, record):
            lines.append(self.format(record))

    handler = Collect(level=logging.DEBUG)
    handler.setFormatter(ContentFreeFormatter("%(levelname)s %(name)s: %(message)s"))
    root = logging.getLogger("backend")
    root.addHandler(handler)
    yield lines
    root.removeHandler(handler)


@pytest.fixture
def replying():
    def build(text):
        app.dependency_overrides[get_llm_service] = lambda: StubLLM(text)
        return TestClient(app, raise_server_exceptions=False)

    yield build
    app.dependency_overrides.clear()


def element(id_="J1", type_="judgment"):
    return {
        "id": id_,
        "type": type_,
        "status": "active",
        "confidence": 0.67,
        "text": f"{MARK} is what I believe about {id_}",
        "addedRound": 1,
        "origin": "user",
    }


def assert_unmarked(lines):
    assert lines, "nothing was logged, so this proved nothing"
    leaked = [line for line in lines if MARK in line]
    assert not leaked, leaked


# ── The formatter ─────────────────────────────────────────────────────────────


def test_a_traceback_names_its_exceptions_but_never_quotes_them():
    def fail():
        try:
            raise KeyError(f"{MARK} in the cause")
        except KeyError as cause:
            raise ValueError(f"{MARK} in the effect") from cause

    try:
        fail()
    except ValueError:
        record = logging.LogRecord(
            "backend.x", logging.ERROR, __file__, 1, "failed", None, sys_exc_info()
        )

    text = ContentFreeFormatter("%(message)s").format(record)

    assert MARK not in text
    assert "KeyError (message withheld)" in text
    assert "ValueError (message withheld)" in text
    assert "direct cause" in text
    assert "in fail" in text, "the frames are what a traceback is read for"


def sys_exc_info():
    import sys

    return sys.exc_info()


# ── The paths that used to log content ────────────────────────────────────────


def test_an_unparseable_reply_is_logged_by_its_length(replying, backend_log):
    client = replying(f"not json at all, but it quotes you: {MARK}")
    res = client.post(
        "/api/theories/suggest",
        json={"topic": MARK, "elements": [element(), element("P1", "principle")]},
    )
    assert res.status_code == 502
    assert_unmarked(backend_log)


def test_a_dropped_source_does_not_quote_its_theory(replying, backend_log, monkeypatch):
    async def unchecked(sources, settings):
        return [crossref.Verdict("unchecked")] * len(sources)

    monkeypatch.setattr("backend.routers.theories.verify", unchecked)
    reply = {"suggestions": [{"text": f"{MARK} theory", "sources": [{"type": "book"}]}]}
    res = replying(json.dumps(reply)).post(
        "/api/theories/suggest",
        json={"topic": "t", "elements": [element(), element("P1", "principle")]},
    )
    assert res.status_code == 200
    assert_unmarked(backend_log)


@pytest.mark.parametrize(
    "path, body",
    [
        ("/api/judgments/elicit", {"topic": MARK, "elements": [element()], "log": []}),
        (
            "/api/review/analyze",
            {
                "state": {
                    "topic": MARK,
                    "round": 3,
                    "elements": [element()],
                    "relations": [],
                    "log": [],
                }
            },
        ),
    ],
)
def test_the_topic_is_not_logged(replying, backend_log, path, body):
    replying("{}").post(path, json=body)
    assert_unmarked(backend_log)


def test_a_completion_is_logged_by_its_length(replying, backend_log):
    res = replying(f"{MARK} said back").post(
        "/api/llm/complete",
        json={"messages": [{"role": "user", "content": MARK}]},
    )
    assert res.status_code == 200
    assert_unmarked(backend_log)


def test_argument_detection_failures_quote_nothing(replying, backend_log):
    reply = {
        "arguments": [[1, 3]],
        "added_premises": [
            # Malformed: no type, so it is skipped with a warning.
            {"index": 4, "text": f"{MARK} premise"},
            # Parses as a premise, but its form is words, not indices.
            {
                "index": 3,
                "type": "principle",
                "text": f"{MARK} premise",
                "form": f"if {MARK} then 1",
            },
        ],
    }
    res = replying(json.dumps(reply)).post(
        "/api/arguments/detect",
        json={
            "elements": [element(), element("J2"), element("P1", "principle")],
            "round": "1",
            "topic": MARK,
        },
    )
    assert res.status_code == 200
    assert_unmarked(backend_log)


def test_an_argument_detection_crash_is_logged_without_its_message(
    replying, backend_log
):
    res = replying(f"{{broken json {MARK}").post(
        "/api/arguments/detect",
        json={
            "elements": [element(), element("J2"), element("P1", "principle")],
            "round": "1",
            "topic": MARK,
        },
    )
    assert res.status_code == 500
    assert_unmarked(backend_log)


def test_a_simulation_crash_is_logged_without_its_message(backend_log, monkeypatch):
    async def crash(*args, **kwargs):
        raise ValueError(f"could not place {MARK}")

    monkeypatch.setattr("backend.routers.simulate_rethon.run_in_pool", crash)
    app.dependency_overrides[get_llm_service] = lambda: None
    elements = [element("J1"), element("P2", "principle"), element("J3")]
    relations = [
        {
            "from": premise,
            "to": "J1",
            "type": "jointly_entails",
            "explanation": "",
            "addedRound": 1,
            "argumentId": "a1",
        }
        for premise in ("P2", "J3")
    ]
    res = TestClient(app, raise_server_exceptions=False).post(
        "/api/simulate_rethon/simulate",
        json={"round": "1", "elements": elements, "relations": relations},
    )
    assert res.status_code == 500
    assert_unmarked(backend_log)
    assert any("ValueError (message withheld)" in line for line in backend_log)


@pytest.mark.asyncio
async def test_a_crossref_failure_names_neither_the_work_nor_the_url(
    backend_log, monkeypatch
):
    async def unreachable(self, url, params=None, **kwargs):
        request = httpx.Request("GET", url, params=params)
        raise httpx.ConnectError(f"could not reach {request.url}", request=request)

    monkeypatch.setattr(httpx.AsyncClient, "get", unreachable)
    crossref._cache.clear()
    source = RESource(
        type="book",
        authors=["Parfit, D."],
        year="1984",
        title=f"{MARK} and persons",
        publisher="Oxford University Press",
    )

    verdicts = await crossref.verify([source], make_settings())

    assert [v.state for v in verdicts] == ["unchecked"]
    assert_unmarked(backend_log)
