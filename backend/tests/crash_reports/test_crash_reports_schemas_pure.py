import pytest
from pydantic import ValidationError

from app.crash_reports.crash_reports_schemas_pure import ClientErrorReport
from tests.crash_reports.crash_reports_fakes import report


def test_optional_context_defaults_to_none() -> None:
    parsed = report()
    assert (parsed.stack, parsed.component_stack, parsed.profile_id, parsed.game_id) == (None, None, None, None)


def test_requires_message_source_url_and_user_agent() -> None:
    with pytest.raises(ValidationError):
        ClientErrorReport.model_validate({"message": "boom"})
