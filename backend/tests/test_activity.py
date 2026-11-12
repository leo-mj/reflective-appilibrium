"""The server says, as it stops, how long it was up and how long idle.

A hosted instance is stopped some time after its last request, and how long is
not a documented constant; this line is how it can be read off the logs.
"""

import re
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from backend import activity

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_the_summary_counts_requests_and_says_how_long_ago_the_last_was(monkeypatch):
    monkeypatch.setattr(activity, "_started", 1000.0)
    monkeypatch.setattr(activity, "_requests", 3)
    monkeypatch.setattr(activity, "_last_request", 1000.0 + 60)
    monkeypatch.setattr(activity.time, "monotonic", lambda: 1000.0 + 60 + 14 * 60 + 5)
    assert activity.shutdown_summary() == (
        "Shutting down after 15 min 5 s up; 3 requests served, the last 14 min 5 s ago."
    )


def test_the_summary_of_a_server_nobody_used(monkeypatch):
    monkeypatch.setattr(activity, "_started", 0.0)
    monkeypatch.setattr(activity, "_last_request", None)
    monkeypatch.setattr(activity.time, "monotonic", lambda: 2 * 3600 + 120.0)
    assert activity.shutdown_summary() == "Shutting down after 2 h 2 min up; no requests served."


def test_a_sigterm_logs_the_summary():
    """What Cloud Run does before stopping an instance, done to a real server."""
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", str(port)],
        cwd=REPO_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        deadline = time.monotonic() + 60
        while True:
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=2)
                break
            except OSError:
                if time.monotonic() > deadline or server.poll() is not None:
                    raise
                time.sleep(0.2)
        server.send_signal(signal.SIGTERM)
        out, _ = server.communicate(timeout=30)
    finally:
        if server.poll() is None:
            server.kill()
    assert re.search(r"Shutting down after \d+ s up; 1 request served, the last \d+ s ago\.", out), out
