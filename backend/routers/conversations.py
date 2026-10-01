"""
Conversations router — /api/conversations

Per-suggestion Q&A. The server keeps nothing between requests: the browser holds
the conversation and sends the RE state, the suggestion under discussion and the
whole history with every turn. The server builds the system prompt, calls the
model and forgets.

It used to keep each conversation in memory so a follow-up could send only its
new message. That saved request size and nothing else — LLM APIs are stateless,
so the provider received the full prompt and history on every call regardless —
and it cost a hosted instance someone's reasoning held in memory, conversations
lost on every restart or sleep, a shared session cap that let one busy visitor
end others' conversations, and a single-worker requirement.

What the store used to bound, the request schema bounds now: the number of turns
and the length of each, so the cost of one request stays capped.
"""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from ..dependencies import get_llm_service
from ..models.re_state import REState
from ..services.llm import LLMService
from ..services.prompts import build_conversation_system

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

# Ceiling on exchanges (a question and its reply) per conversation. The whole
# history is resent as context on every turn, so an unbounded conversation grows
# the cost of each request until it exceeds the model's context window. A request
# carries the previous exchanges plus the new question, so at most
# 2 * MAX_EXCHANGES - 1 messages. The frontend's ConversationPanel mirrors this.
MAX_EXCHANGES = 20
MAX_MESSAGES = 2 * MAX_EXCHANGES - 1

MAX_QUESTION_CHARS = 10_000

# Replies are the model's, and are sent back as history. OpenAI-compatible
# providers are called without max_tokens, so this is generous: a bound that a
# long reply could exceed would end the conversation on the next turn.
MAX_REPLY_CHARS = 50_000


# ── Request / response models ──────────────────────────────────────────────────


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_REPLY_CHARS)


class ConversationRequest(BaseModel):
    """One turn: the context, and the conversation so far ending with the new question."""

    state: REState
    suggestion: dict[str, Any] = Field(max_length=50)
    messages: list[Message] = Field(min_length=1, max_length=MAX_MESSAGES)

    @field_validator("messages")
    @classmethod
    def _questions_and_replies_alternate(cls, messages: list[Message]) -> list[Message]:
        for i, message in enumerate(messages):
            expected = "user" if i % 2 == 0 else "assistant"
            if message.role != expected:
                raise ValueError(
                    "messages must alternate user and assistant, starting and "
                    "ending with user"
                )
            if expected == "user" and len(message.content) > MAX_QUESTION_CHARS:
                raise ValueError(
                    f"a question may be at most {MAX_QUESTION_CHARS} characters"
                )
        if len(messages) % 2 == 0:
            raise ValueError("messages must end with the user's question")
        return messages


class ConversationResponse(BaseModel):
    reply: str
    model: str


# ── Endpoint ───────────────────────────────────────────────────────────────────


@router.post("", response_model=ConversationResponse)
async def converse(
    request: ConversationRequest,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> ConversationResponse:
    """Answer the last question in a conversation about a suggestion."""
    system = build_conversation_system(request.state, request.suggestion)
    reply = await llm.complete(
        messages=[{"role": "system", "content": system}]
        + [m.model_dump() for m in request.messages],
        temperature=0.5,
    )
    return ConversationResponse(reply=reply, model=llm.model)
