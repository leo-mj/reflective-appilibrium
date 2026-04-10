"""
Shared FastAPI dependencies.

Each `get_*` function can be overridden in tests via `app.dependency_overrides`.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends

from .config import Settings, get_settings
from .services.llm import LLMService
from .storage import MarkdownSessionStore


@lru_cache
def get_session_store() -> MarkdownSessionStore:
    """Return the singleton session store backed by the configured directory.

    Override in tests with ``app.dependency_overrides[get_session_store]``.
    To swap for a SQLite backend, change the return type and body here; the
    router depends only on the ``SessionStore`` protocol, not this concrete type.
    """
    return MarkdownSessionStore(Path(get_settings().sessions_dir))


def get_llm_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> LLMService:
    """Construct an ``LLMService`` from the current application settings.

    Injected by FastAPI into every endpoint that declares an
    ``Annotated[LLMService, Depends(get_llm_service)]`` parameter.
    Override in tests with ``app.dependency_overrides[get_llm_service]``.
    """
    return LLMService(settings)
