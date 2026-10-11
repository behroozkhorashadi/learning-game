"""Client error reporting: format the report, write it to the injected log."""

from app.crash_reports.crash_reports_ports_pure import ClientErrorLog, ClientErrorsService
from app.crash_reports.crash_reports_reducers_pure import log_entry
from app.crash_reports.crash_reports_schemas_pure import ClientErrorReport


def make_crash_reports_service(*, log: ClientErrorLog) -> ClientErrorsService:
    def report(error: ClientErrorReport) -> None:
        log.write(log_entry(error))

    return ClientErrorsService(report=report)
