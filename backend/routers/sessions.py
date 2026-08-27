"""
Sessions router — /api/sessions

CRUD endpoints for persisting RE states as markdown files on disk.
The storage layer is injected as a dependency so it can be swapped for a
SQLite backend without changing this file.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_session_store
from ..models.re_state import REState
from ..storage import MarkdownSessionStore, SessionMeta

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.post("", response_model=SessionMeta, status_code=201)
def save_session(
    state: REState,
    store: Annotated[MarkdownSessionStore, Depends(get_session_store)],
) -> SessionMeta:
    """Persist an RE state and return its metadata (including the new session_id)."""
    return store.save(state)


@router.get("", response_model=list[SessionMeta])
def list_sessions(
    store: Annotated[MarkdownSessionStore, Depends(get_session_store)],
) -> list[SessionMeta]:
    """Return metadata for all saved sessions, newest first."""
    return store.list_sessions()


@router.get("/{session_id}", response_model=REState, response_model_exclude_none=True)
def load_session(
    session_id: str,
    store: Annotated[MarkdownSessionStore, Depends(get_session_store)],
) -> REState:
    """Load and return the full RE state for a session.

    ``exclude_none`` keeps this response identical to what the store writes to
    disk, so the state the frontend gets from the API and the state it gets from
    importing the saved file are the same shape.  Without it every unset optional
    field arrives as an explicit ``null``, which the frontend's own export would
    then round-trip back out into a file.
    """
    try:
        return store.load(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")


@router.delete("/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    store: Annotated[MarkdownSessionStore, Depends(get_session_store)],
) -> None:
    """Delete a session file permanently."""
    try:
        store.delete(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")
