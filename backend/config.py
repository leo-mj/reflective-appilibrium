"""
Application configuration loaded from the .env file adjacent to this module.

Settings are read once and cached; the LLM adapter and CORS policy are
controlled entirely by environment variables so the app can target any
OpenAI-compatible endpoint without code changes.
"""

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    """Pydantic-settings model for the backend configuration.

    All fields can be overridden via environment variables or the .env file.
    The ``openai_base_url`` default points at OpenAI; set it to a local
    Ollama/vLLM URL to run entirely offline.
    """

    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    openai_api_key: str
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        """Return ``cors_origins`` as a list, split on commas."""
        return [o.strip() for o in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings (reads .env on first call)."""
    return Settings()
