"""Backend configuration, read from the environment once, in assembly only. Feature
flags live here too; code below assembly receives their effect, never the flag.

Field names match the environment variables case-insensitively (`ADMIN_PASSWORD`,
`DATABASE_URL`, `OPENAI_API_KEY`, ...). `backend/.env` is loaded into the environment
by the legacy `app/__init__.py` until that goes; see `backend/.env.example`.
"""

from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(frozen=True, extra="ignore")

    # The admin screen's shared password (see app/admin/admin_ports_pure.py). Required:
    # the app refuses to start without one rather than come up with the gate open.
    admin_password: SecretStr = Field(default=SecretStr(""), validate_default=True)
    database_url: str = "sqlite:///./learning_game.db"
    # Served at /static: profile pictures and generated illustrations.
    static_dir: Path = Path("static")
    # Where POST /api/client-errors writes client_errors.log (relative to the working directory).
    log_dir: Path = Path("logs")
    # The image provider. Without a key, photo remixes report "unavailable".
    openai_api_key: SecretStr | None = None
    openai_image_model: str = "gpt-image-1"
    openai_image_size: str = "1024x1024"
    # Illustrations: "openai" (when a key is set) or "none" (always the placeholder).
    image_provider: Literal["openai", "none"] = "openai"
    # An optional second seed profile for a real named tester, kept out of the repo.
    local_seed_profile_name: str | None = None
    local_seed_profile_avatar: str = "fox"
    local_seed_profile_birth_year: int = 2019
    # Feature flag: mount the /api/examples/todos worked example.
    todo_example_enabled: bool = True

    @field_validator("admin_password")
    @classmethod
    def _admin_password_is_set(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value():
            msg = (
                "ADMIN_PASSWORD is not set. Add it to backend/.env (see backend/.env.example) "
                "before starting the server."
            )
            raise ValueError(msg)
        return value


def load_settings() -> AppSettings:
    """Raises a ValidationError naming ADMIN_PASSWORD when it's missing."""
    return AppSettings()
