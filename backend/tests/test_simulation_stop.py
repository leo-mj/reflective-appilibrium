"""A caller that goes away stops its computation.

The frontend's Stop button aborts the fetch; closing the tab drops the
connection. Either way the only thing the server sees is a socket closing, and
uvicorn keeps running the handler regardless — so these run against a real
uvicorn server over a real socket. TestClient cannot hang up halfway through a
request, which is the one thing being tested.
"""

import asyncio
import json
import socket
import threading
import time
from pathlib import Path

import pytest
import uvicorn

from backend import process_pool
from backend.config import get_settings
from backend.main import app
from backend.tests.conftest import make_settings
from backend.tests.test_process_pool import (
    _ONE_SECOND_OF_WORK,
    _assert_stopped,
    _deterministic_rounds,
    _hold_the_gil,
    _payload,
    _worker_processes,
)


def _thirty_seconds(*_args):
    """Stands in for a simulation that would run far longer than the test."""
    return _hold_the_gil(30 * _ONE_SECOND_OF_WORK)


@pytest.fixture
def server():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    app.dependency_overrides[get_settings] = lambda: make_settings()
    srv = uvicorn.Server(
        uvicorn.Config(
            app, host="127.0.0.1", port=port, lifespan="off", log_level="warning"
        )
    )
    thread = threading.Thread(target=srv.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not srv.started and time.monotonic() < deadline:
        time.sleep(0.02)
    assert srv.started
    yield port
    srv.should_exit = True
    thread.join(timeout=10)
    app.dependency_overrides.clear()


def _post_and_hang_up(port: int, path: str, body: dict, after: float) -> None:
    payload = json.dumps(body).encode()
    with socket.create_connection(("127.0.0.1", port)) as conn:
        conn.sendall(
            (
                f"POST {path} HTTP/1.1\r\nHost: 127.0.0.1\r\n"
                f"Content-Type: application/json\r\nContent-Length: {len(payload)}\r\n\r\n"
            ).encode()
            + payload
        )
        time.sleep(after)


@pytest.mark.parametrize(
    "path, worker, body",
    [
        ("/simulate", "simulate_to_fixed_point", {"round": "1", **_payload()}),
        ("/step", "simulate_one_step", {"round": "1", **_payload()}),
        ("/score_per_round", "compute_score_per_round", _deterministic_rounds()),
    ],
)
def test_hanging_up_stops_the_computation(server, monkeypatch, path, worker, body):
    monkeypatch.setattr(f"backend.routers.simulate_rethon.{worker}", _thirty_seconds)
    asyncio.run(process_pool.run_in_pool("simulation", _hold_the_gil, 0))  # warm
    workers = _worker_processes("simulation")

    _post_and_hang_up(server, f"/api/simulate_rethon{path}", body, after=0.5)
    assert all(p.is_alive() for p in workers), "stopped before the caller left"

    _assert_stopped(workers)  # within seconds, not thirty


_BACKEND = str(Path(process_pool.__file__).parent)
_NOT_OURS = (str(Path(__file__).parent), str(Path(_BACKEND) / ".venv"))


@pytest.fixture
def exceptions_in_backend_code():
    """Every exception passing through a backend frame, in threads started from
    here on — so request it before ``server``, whose thread must be one of them."""
    seen = []

    def tracer(frame, event, arg):
        path = frame.f_code.co_filename
        if path.startswith(_BACKEND) and not path.startswith(_NOT_OURS):
            if event == "exception" and not issubclass(arg[0], StopIteration):
                seen.append((arg[0].__name__, frame.f_code.co_name))
            return tracer
        return tracer if event == "call" else None

    threading.settrace(tracer)
    yield seen
    threading.settrace(None)


def test_hanging_up_raises_nothing_in_backend_code_but_the_stop_itself(
    exceptions_in_backend_code, server, monkeypatch
):
    """A Stop press must not look like a fault to a debugger.

    VS Code breaking on "uncaught" and "user uncaught" exceptions stopped on
    every Stop: first on a raised 499, then on the CancelledError that cancelling
    ``run_in_pool`` puts in its frame. Both leave backend code for FastAPI's or
    asyncio's, which is exactly what such a debugger breaks on. This records
    every exception that passes through a backend frame while a caller hangs up,
    and allows only ComputationStopped, which is raised and caught in backend
    code alike.
    """
    monkeypatch.setattr(
        "backend.routers.simulate_rethon.simulate_to_fixed_point", _thirty_seconds
    )
    asyncio.run(process_pool.run_in_pool("simulation", _hold_the_gil, 0))  # warm
    workers = _worker_processes("simulation")
    seen = exceptions_in_backend_code
    seen.clear()  # start-up's own, from settings validation and the like

    _post_and_hang_up(
        server, "/api/simulate_rethon/simulate", {"round": "1", **_payload()}, 0.5
    )
    _assert_stopped(workers)
    time.sleep(0.5)  # let the handler finish after the kill

    names = {name for name, _ in seen}
    assert "ComputationStopped" in names, "the tracer never saw the request"
    assert names == {"ComputationStopped"}, seen


def test_a_caller_who_waits_still_gets_the_result(server):
    """The disconnect check must not mistake a caller who is merely waiting."""
    payload = json.dumps({"round": "1", **_payload()}).encode()
    with socket.create_connection(("127.0.0.1", server), timeout=60) as conn:
        conn.sendall(
            (
                "POST /api/simulate_rethon/simulate HTTP/1.1\r\nHost: 127.0.0.1\r\n"
                "Content-Type: application/json\r\n"
                f"Content-Length: {len(payload)}\r\nConnection: close\r\n\r\n"
            ).encode()
            + payload
        )
        response = b""
        while chunk := conn.recv(65536):
            response += chunk
    assert response.startswith(b"HTTP/1.1 200")
