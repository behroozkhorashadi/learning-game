from pathlib import Path

import pytest
from pydantic import ValidationError
from pydantic_settings import SettingsConfigDict

from app.composition.app_settings_assembly import BACKEND_ROOT, AppSettings


class EnvOnlySettings(AppSettings):
    """AppSettings without backend/.env, so a developer's real file can't mask a test."""

    model_config = SettingsConfigDict(env_file=None)


@pytest.mark.parametrize("value", [None, ""])
def test_app_refuses_to_start_without_admin_password(monkeypatch: pytest.MonkeyPatch, value: str | None) -> None:
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    if value is not None:
        monkeypatch.setenv("ADMIN_PASSWORD", value)
    with pytest.raises(ValidationError, match="ADMIN_PASSWORD is not set"):
        EnvOnlySettings()


def test_reads_the_environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    for name in ("OPENAI_API_KEY", "IMAGE_PROVIDER"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ADMIN_PASSWORD", "from-env")
    monkeypatch.setenv("LOG_DIR", str(tmp_path / "logs"))
    settings = EnvOnlySettings()
    assert settings.admin_password.get_secret_value() == "from-env"
    assert settings.log_dir == tmp_path / "logs"
    assert (settings.image_provider, settings.openai_api_key) == ("openai", None)


def test_the_app_also_reads_backend_env() -> None:
    assert AppSettings.model_config.get("env_file") == BACKEND_ROOT / ".env"


def test_unknown_image_provider_fails_at_startup(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ADMIN_PASSWORD", "x")
    monkeypatch.setenv("IMAGE_PROVIDER", "midjourney")
    with pytest.raises(ValidationError):
        EnvOnlySettings()
