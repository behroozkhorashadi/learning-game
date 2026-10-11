"""Backend configuration, read from the environment once, in assembly only. Feature
flags live here too; code below assembly receives their effect, never the flag."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(frozen=True, extra="ignore")

    database_url: str = "sqlite:///./learning_game.db"
    # Where POST /api/client-errors writes client_errors.log (relative to the working directory).
    log_dir: Path = Path("logs")
    # Feature flag: mount the /api/examples/todos worked example.
    todo_example_enabled: bool = True


def load_settings() -> AppSettings:
    return AppSettings()
