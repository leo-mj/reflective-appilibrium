"""The log's shape: one JSON line per record, tied to its request, and complete.

The content rule — no exception message, no user text — is test_log_privacy's.
These pin what makes the log usable for debugging: ``LOG_FORMAT=json`` writes
lines a collector can read, each line a request writes carries that request's
id, and the exceptions uvicorn reports are no longer switched off by rethon.
"""

import json
import logging
import logging.config
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from uvicorn.config import LOGGING_CONFIG

from backend import logging_setup
from backend.logging_setup import (
    JsonFormatter,
    RequestIdMiddleware,
    configure_backend_logging,
    request_id_from,
)
from backend.main import app

MARK = "ZEBRA-MARKER-7741"
TRACE = "4bf92f3577b34da6a3ce929d0e0e4736"


def record(level=logging.INFO, msg="hello %s", args=("world",), exc_info=None):
    return logging.LogRecord(
        "backend.x", level, __file__, 1, msg, args, exc_info, func="f"
    )


def failure():
    try:
        try:
            raise KeyError(f"{MARK} in the cause")
        except KeyError as cause:
            raise ValueError(f"{MARK} in the effect") from cause
    except ValueError:
        return sys.exc_info()


# ── The JSON line ─────────────────────────────────────────────────────────────


def test_a_record_is_one_json_line_a_collector_can_read():
    line = JsonFormatter().format(record(logging.WARNING))

    assert "\n" not in line
    entry = json.loads(line)
    assert entry["severity"] == "WARNING"
    assert entry["message"] == "hello world"
    assert entry["logger"] == "backend.x"
    assert entry["time"].endswith("Z")
    assert "request_id" not in entry, "no request, no id"
    assert "stack_trace" not in entry


def test_a_traceback_stays_in_its_line_with_its_messages_withheld():
    line = JsonFormatter().format(
        record(logging.ERROR, "failed", (), exc_info=failure())
    )

    assert "\n" not in line, "a collector would file each traceback line apart"
    assert MARK not in line
    entry = json.loads(line)
    assert entry["severity"] == "ERROR"
    assert entry["message"] == "failed"
    trace = entry["stack_trace"]
    assert trace.startswith("Traceback (most recent call last):")
    assert "KeyError (message withheld)" in trace
    assert "ValueError (message withheld)" in trace
    assert "in failure" in trace


# ── Request ids ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "headers",
    [
        {"traceparent": f"00-{TRACE}-00f067aa0ba902b7-01"},
        {"x-cloud-trace-context": f"{TRACE}/1;o=1"},
        {"x-cloud-trace-context": TRACE.upper()},
        # The standard header wins over Google's when both arrive.
        {
            "traceparent": f"00-{TRACE}-00f067aa0ba902b7-01",
            "x-cloud-trace-context": "f" * 32 + "/1",
        },
    ],
)
def test_the_id_is_the_trace_the_proxy_started(headers):
    assert request_id_from(headers) == TRACE


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"traceparent": "00-" + "0" * 32 + "-00f067aa0ba902b7-01"},
        {"traceparent": f"00-{TRACE}-short-01"},
        {"x-cloud-trace-context": f'{TRACE[:-1]}"}}, "severity": "ERROR'},
        {"x-cloud-trace-context": "not hex at all"},
    ],
)
def test_without_a_well_formed_trace_the_id_is_fresh(headers):
    first, second = request_id_from(headers), request_id_from(headers)
    assert len(first) == 32 and int(first, 16) >= 0
    assert first != second
    assert first != TRACE


@pytest.fixture
def json_lines():
    lines = []

    class Collect(logging.Handler):
        def emit(self, rec):
            lines.append(json.loads(self.format(rec)))

    handler = Collect()
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("backend.request_test")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    yield lines
    logger.removeHandler(handler)


def test_every_line_a_request_writes_carries_its_id(json_lines):
    probe = FastAPI()
    probe.add_middleware(RequestIdMiddleware)

    @probe.get("/probe")
    async def handler():
        logging.getLogger("backend.request_test").info("first")
        logging.getLogger("backend.request_test").warning("second")
        return {}

    client = TestClient(probe)
    client.get("/probe", headers={"traceparent": f"00-{TRACE}-00f067aa0ba902b7-01"})
    client.get("/probe")

    ids = [line["request_id"] for line in json_lines]
    assert ids[:2] == [TRACE, TRACE]
    assert ids[2] == ids[3] != TRACE, "the next request gets an id of its own"


def test_the_app_assigns_request_ids():
    assert RequestIdMiddleware in [m.cls for m in app.user_middleware]


# ── uvicorn's loggers ─────────────────────────────────────────────────────────


@pytest.fixture
def uvicorn_as_served(monkeypatch):
    """uvicorn's logging as it stands once rethon's import has switched it off."""
    names = ("uvicorn", "uvicorn.error", "uvicorn.access")
    saved = {
        n: (lg.handlers[:], lg.propagate, lg.disabled, lg.level)
        for n, lg in ((n, logging.getLogger(n)) for n in names)
    }
    backend_handlers = logging.getLogger("backend").handlers[:]
    logging.config.dictConfig(LOGGING_CONFIG)
    for n in names:
        logging.getLogger(n).disabled = True
    monkeypatch.setattr(logging_setup, "_handler", None)
    yield
    for n, (handlers, propagate, disabled, level) in saved.items():
        lg = logging.getLogger(n)
        lg.handlers, lg.propagate, lg.disabled = handlers, propagate, disabled
        lg.setLevel(level)
    logging.getLogger("backend").handlers = backend_handlers


def test_an_exception_escaping_the_app_is_logged_again(uvicorn_as_served, capsys):
    configure_backend_logging("json")

    # What uvicorn's HTTP protocol does when the app raises.
    logging.getLogger("uvicorn.error").error(
        "Exception in ASGI application\n", exc_info=failure()
    )

    err = capsys.readouterr().err
    assert MARK not in err, "uvicorn's own formatter would have quoted it"
    lines = [json.loads(line) for line in err.splitlines()]
    assert len(lines) == 1
    assert lines[0]["logger"] == "uvicorn.error"
    assert lines[0]["severity"] == "ERROR"
    assert "ValueError (message withheld)" in lines[0]["stack_trace"]


def test_the_access_log_stays_off(uvicorn_as_served):
    logging.getLogger("uvicorn.access").disabled = False

    configure_backend_logging("json")

    assert logging.getLogger("uvicorn.access").disabled
