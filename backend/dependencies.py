"""
Shared FastAPI dependencies.

Each `get_*` function can be overridden in tests via `app.dependency_overrides`.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException

from .config import Settings, get_settings
from .services.llm import LLMConfig, LLMService
from .storage import MarkdownSessionStore

# Must stay in sync with LLM_PROVIDERS in app/src/constants/llmProviders.js.
# This is the security boundary — the frontend list is UX only.
ALLOWED_BASE_URLS = {
    "https://api.openai.com/v1",
    "https://api.mistral.ai/v1",
    "https://api.anthropic.com/v1",
    "http://localhost:11434/v1",
}


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
    x_api_key: Annotated[Optional[str], Header()] = None,
    x_base_url: Annotated[Optional[str], Header()] = None,
    x_model: Annotated[Optional[str], Header()] = None,
) -> LLMService:
    """Construct an ``LLMService``, preferring BYOK headers over server settings.

    Injected by FastAPI into every endpoint that declares an
    ``Annotated[LLMService, Depends(get_llm_service)]`` parameter.
    Override in tests with ``app.dependency_overrides[get_llm_service]``.
    """
    if not x_base_url:
        raise HTTPException(status_code=400, detail="Missing x-base-url header")
    if x_base_url not in ALLOWED_BASE_URLS:
        raise HTTPException(status_code=400, detail="Unsupported provider URL")
    api_key = x_api_key or settings.llm_api_keys.get(x_base_url)
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured")
    config = LLMConfig(
        api_key=api_key,
        base_url=x_base_url,
        model=x_model or settings.default_model,
    )
    return LLMService(config)
