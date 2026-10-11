from app.crash_reports.crash_reports_reducers_pure import log_entry
from tests.crash_reports.crash_reports_fakes import report


def test_entry_has_a_header_line_then_both_stacks() -> None:
    entry = log_entry(report(stack="at x", profile_id=3, message="it's broken"))
    assert entry == (
        "source=window-error url=http://kid.local/ profile_id=3 game_id=None user_agent='Kidfox/1.0' "
        'message="it\'s broken"\nstack=at x\ncomponent_stack=None'
    )
