from app.crash_reports.crash_reports_service_effect import make_crash_reports_service
from tests.crash_reports.crash_reports_fakes import InMemoryClientErrorLog, report


def test_report_writes_one_formatted_entry() -> None:
    log = InMemoryClientErrorLog()
    make_crash_reports_service(log=log).report(report(game_id="fact_fluency"))
    assert len(log.entries) == 1
    assert "game_id=fact_fluency" in log.entries[0]
