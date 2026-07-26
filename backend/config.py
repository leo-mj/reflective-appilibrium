"""
Application configuration loaded from the .env file adjacent to this module.

Settings are read once and cached; the LLM adapter and CORS policy are
controlled entirely by environment variables so the app can target any
OpenAI-compatible endpoint without code changes.
"""

from functools import lru_cache
from pathlib import Path  # used in default value for sessions_dir
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    """Pydantic-settings model for the backend configuration.

    All fields can be overridden via environment variables or the .env file.
    """

    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    llm_api_keys: dict[str, str] = {}
    default_model: str = "gpt-4o-mini"
    cors_origins: str = "http://localhost:5173"
    sessions_dir: str = str(Path(__file__).parent.parent / "sessions")

    # Output cap for a single Anthropic completion, which the Messages API
    # requires explicitly.  Not sent to OpenAI-compatible providers, which do
    # not require it and would be newly constrained by it.  The relation and
    # argument tasks scale their output with the element count, so a too-low
    # value truncates the reply mid-JSON; the service logs a warning when a
    # response stops at the cap.
    llm_max_tokens: int = 4096

    @field_validator("cors_origins")
    @classmethod
    def no_wildcard(cls, v: str) -> str:
        if any(o.strip() == "*" for o in v.split(",")):
            raise ValueError(
                "Wildcard '*' is not permitted in CORS_ORIGINS; list specific origins explicitly."
            )
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        """Return ``cors_origins`` as a list, split on commas."""
        return [o.strip() for o in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings (reads .env on first call)."""
    return Settings()
