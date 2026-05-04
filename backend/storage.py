"""
Session storage — markdown-file backend.

The public interface (``SessionStore`` Protocol + ``SessionMeta``) is kept
deliberately thin so the concrete implementation can be swapped for SQLite or
another backend later without touching the router layer:

    # To migrate: implement SessionStore on a new class, then change
    # dependencies.get_session_store to return it instead.

File naming convention: ``{YYYYMMDD_HHMMSS}_{slug}.md``
where the slug is derived from the RE topic (lowercase, punctuation stripped,
spaces collapsed to hyphens, max 40 chars).  If two sessions are saved in the
same UTC second with the same slug a numeric suffix (_2, _3 …) is appended.

The markdown format is the same ``re-state`` fenced block used by the frontend
export, so any saved session can be re-imported by the frontend drag-and-drop.
"""

import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol, runtime_checkable

from pydantic import BaseModel

from .models.re_state import REState


# ── Public data model ──────────────────────────────────────────────────────────


class SessionMeta(BaseModel):
    """Lightweight descriptor returned by list and save operations.

    Carries enough information to populate a session browser without loading
    the full state.  When migrating to SQLite these fields map directly to
    columns on a ``sessions`` table.
    """

    session_id: str
    topic: str
    round: int
    saved_at: datetime


# ── Storage protocol (the swap boundary) ──────────────────────────────────────


@runtime_checkable
class SessionStore(Protocol):
    """Minimal interface every storage backend must satisfy.

    Keeping the protocol this thin means a SQLite implementation only needs to
    provide these four methods and a matching ``get_session_store`` dependency.
    """

    def save(self, state: REState) -> SessionMeta: ...
    def load(self, session_id: str) -> REState: ...
    def list_sessions(self) -> list[SessionMeta]: ...
    def delete(self, session_id: str) -> None: ...


# ── Markdown helpers ───────────────────────────────────────────────────────────

_OPEN = "```re-state"
_CLOSE = "```"


def _extract_json(text: str) -> str:
    """Return the raw JSON string from the first ``re-state`` fenced block."""
    start = text.index(_OPEN)
    line_end = text.index("\n", start + len(_OPEN))
    close = text.index(_CLOSE, line_end + 1)
    return text[line_end + 1 : close].strip()


def _slugify(topic: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", topic.lower()).strip()
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:40].rstrip("-") or "untitled"


def _render_markdown(state: REState, saved_at: datetime) -> str:
    title = state.topic or "Untitled"
    ts = saved_at.strftime("%Y-%m-%d %H:%M:%S UTC")
    json_str = state.model_dump_json(by_alias=True, indent=2)
    return f"# {title}\n\nSaved: {ts}\n\n```re-state\n{json_str}\n```\n"


def _saved_at_from_stem(stem: str) -> datetime:
    """Parse the UTC timestamp embedded in ``{YYYYMMDD_HHMMSS}_{slug}`` stems."""
    parts = stem.split("_")
    ts_str = parts[0] + parts[1]  # "20260410" + "143022" → "20260410143022"
    return datetime.strptime(ts_str, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)


# ── Concrete markdown implementation ──────────────────────────────────────────


class MarkdownSessionStore:
    """Stores RE sessions as markdown files under a local directory.

    Each file contains a human-readable header and a ``re-state`` fenced block
    that is identical to the format exported by the frontend, so sessions are
    interchangeable between the backend store and the frontend file import.

    Writes are atomic: content is written to a ``.tmp`` file and then renamed,
    so a crash mid-write cannot produce a corrupt session file.

    To swap this for a SQLite backend: implement ``SessionStore`` on a new class
    and replace ``MarkdownSessionStore`` in ``dependencies.get_session_store``.
    No router code needs to change.
    """

    def __init__(self, directory: Path) -> None:
        self._dir = directory
        self._dir.mkdir(parents=True, exist_ok=True)

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _path(self, session_id: str) -> Path:
        path = (self._dir / f"{session_id}.md").resolve()
        if not path.is_relative_to(self._dir.resolve()):
            raise ValueError(f"Invalid session_id: {session_id!r}")
        return path

    def _unique_id(self, topic: str) -> str:
        slug = _slugify(topic)
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        candidate = f"{ts}_{slug}"
        if not self._path(candidate).exists():
            return candidate
        for n in range(2, 100):
            candidate = f"{ts}_{slug}_{n}"
            if not self._path(candidate).exists():
                return candidate
        raise RuntimeError("Could not generate a unique session ID")  # pragma: no cover

    # ── SessionStore interface ─────────────────────────────────────────────────

    def save(self, state: REState) -> SessionMeta:
        saved_at = datetime.now(timezone.utc)
        session_id = self._unique_id(state.topic)
        content = _render_markdown(state, saved_at)
        path = self._path(session_id)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(content, encoding="utf-8")
        os.replace(tmp, path)
        return SessionMeta(
            session_id=session_id,
            topic=state.topic,
            round=state.round,
            saved_at=saved_at,
        )

    def load(self, session_id: str) -> REState:
        path = self._path(session_id)
        if not path.exists():
            raise KeyError(session_id)
        return REState.model_validate_json(_extract_json(path.read_text(encoding="utf-8")))

    def list_sessions(self) -> list[SessionMeta]:
        """Return metadata for all sessions, newest first.

        Malformed or unreadable files are silently skipped so a single corrupt
        file does not break the entire listing.
        """
        results: list[SessionMeta] = []
        for path in sorted(self._dir.glob("*.md"), reverse=True):
            try:
                text = path.read_text(encoding="utf-8")
                state = REState.model_validate_json(_extract_json(text))
                saved_at = _saved_at_from_stem(path.stem)
                results.append(SessionMeta(
                    session_id=path.stem,
                    topic=state.topic,
                    round=state.round,
                    saved_at=saved_at,
                ))
            except Exception:  # noqa: BLE001
                pass
        return results

    def delete(self, session_id: str) -> None:
        path = self._path(session_id)
        if not path.exists():
            raise KeyError(session_id)
        path.unlink()
