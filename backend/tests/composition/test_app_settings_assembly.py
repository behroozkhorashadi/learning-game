from pathlib import Path

import pytest
from pydantic import SecretStr, ValidationError

from app.composition.app_settings_assembly import AppSettings, load_settings


@pytest.mark.parametrize("value", [None, ""])
def test_app_refuses_to_start_without_admin_password(monkeypatch: pytest.MonkeyPatch, value: str | None) -> None:
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    if value is not None:
        monkeypatch.setenv("ADMIN_PASSWORD", value)
    with pytest.raises(ValidationError, match="ADMIN_PASSWORD is not set"):
        load_settings()


def test_reads_the_environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("ADMIN_PASSWORD", "from-env")
    monkeypatch.setenv("LOG_DIR", str(tmp_path / "logs"))
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    settings = load_settings()
    assert settings.admin_password.get_secret_value() == "from-env"
    assert settings.log_dir == tmp_path / "logs"
    assert AppSettings(admin_password=SecretStr("x")).openai_api_key is None
