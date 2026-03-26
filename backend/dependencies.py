"""
Shared FastAPI dependencies.

Each `get_*` function can be overridden in tests via `app.dependency_overrides`.
"""

from typing import Annotated

from fastapi import Depends

from .config import Settings, get_settings
from .services.llm import LLMService


def get_llm_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> LLMService:
    return LLMService(settings)
