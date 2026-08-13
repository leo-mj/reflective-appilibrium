"""
Conversations router — /api/conversations

Per-suggestion Q&A sessions. Each session stores a system prompt (built from the
RE state and the suggestion under discussion) and the conversation history.
The frontend only sends a message string after the first request; the RE state
is injected once into the system prompt and not repeated in the history.

Sessions are held in-memory and expire after SESSION_TTL minutes.

Two consequences of "in-memory" worth stating. Sessions live in one worker's
process, so this router assumes a single uvicorn worker — with more, a follow-up
message can land on a worker that has never heard of the session. And memory is
finite, so both the number of sessions and the length of each are capped below;
without that, the store grows for as long as the process lives.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..dependencies import get_llm_service
from ..models.re_state import REState
from ..services.llm import LLMService
from ..services.prompts import build_conversation_system

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

SESSION_TTL = timedelta(minutes=30)

# Ceiling on live conversations. Expiry alone does not bound the store: a caller
# can open sessions faster than the TTL retires them, and each holds a full RE
# state in its system prompt.
MAX_SESSIONS = 200

# Ceiling on stored turns per conversation (user + assistant messages). Every
# turn is resent as context on the next message, so an unbounded conversation
# grows the cost of each request until it exceeds the model's context window.
MAX_MESSAGES = 40


# ── In-memory session store ────────────────────────────────────────────────────


class _Session:
    def __init__(self, system: str) -> None:
        self.system = system
        self.messages: list[dict] = []
        self.expires_at = datetime.now(timezone.utc) + SESSION_TTL


_sessions: dict[str, _Session] = {}


def _purge_expired() -> None:
    now = datetime.now(timezone.utc)
    for k in [k for k, v in _sessions.items() if v.expires_at < now]:
        del _sessions[k]


def _evict_oldest() -> None:
    """Drop the soonest-to-expire sessions until the store is under its cap.

    Dict order is insertion order and every session gets the same TTL, so the
    oldest are at the front. Evicting the least recently *started* rather than
    the least recently used is the conservative choice: it cannot extend the
    lifetime of a session past its TTL.
    """
    while len(_sessions) >= MAX_SESSIONS:
        del _sessions[next(iter(_sessions))]


def _get_session(session_id: str) -> _Session:
    _purge_expired()
    session = _sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    return session


# ── Request / response models ──────────────────────────────────────────────────


class StartRequest(BaseModel):
    """Payload for starting a new conversation."""

    state: REState
    suggestion: dict[str, Any] = Field(max_length=50)
    message: str = Field(min_length=1, max_length=10_000)


class MessageRequest(BaseModel):
    """Payload for a follow-up message in an existing conversation."""

    message: str = Field(min_length=1, max_length=10_000)


class ConversationResponse(BaseModel):
    """Response returned for both start and follow-up endpoints."""

    session_id: str
    reply: str
    model: str


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.post("", response_model=ConversationResponse)
async def start_conversation(
    request: StartRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> ConversationResponse:
    """Start a new conversation about a suggestion. Returns a session_id for follow-up messages."""
    _purge_expired()
    _evict_oldest()
    session_id = str(uuid.uuid4())
    system = build_conversation_system(request.state, request.suggestion)
    session = _Session(system)
    _sessions[session_id] = session

    session.messages.append({"role": "user", "content": request.message})
    reply = await llm.complete(
        messages=[{"role": "system", "content": system}] + session.messages,
        temperature=0.5,
    )
    session.messages.append({"role": "assistant", "content": reply})

    return ConversationResponse(session_id=session_id, reply=reply, model=llm.model)


@router.post("/{session_id}/messages", response_model=ConversationResponse)
async def send_message(
    session_id: str,
    request: MessageRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> ConversationResponse:
    """Send a follow-up message in an existing conversation."""
    session = _get_session(session_id)
    if len(session.messages) >= MAX_MESSAGES:
        raise HTTPException(
            status_code=409,
            detail=(
                f"This conversation has reached its {MAX_MESSAGES // 2}-exchange "
                "limit. Start a new one to keep discussing."
            ),
        )
    session.messages.append({"role": "user", "content": request.message})
    reply = await llm.complete(
        messages=[{"role": "system", "content": session.system}] + session.messages,
        temperature=0.5,
    )
    session.messages.append({"role": "assistant", "content": reply})

    return ConversationResponse(session_id=session_id, reply=reply, model=llm.model)
