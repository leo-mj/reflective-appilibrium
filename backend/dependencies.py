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
    """Construct an ``LLMService`` from the current application settings.

    Injected by FastAPI into every endpoint that declares an
    ``Annotated[LLMService, Depends(get_llm_service)]`` parameter.
    Override in tests with ``app.dependency_overrides[get_llm_service]``.
    """
    return LLMService(settings)
