"""How a client error report reads in the log: one header line of key=value pairs,
then the two stacks."""

from app.crash_reports.crash_reports_schemas_pure import ClientErrorReport


def log_entry(report: ClientErrorReport) -> str:
    return (
        f"source={report.source} url={report.url} profile_id={report.profile_id} game_id={report.game_id} "
        f"user_agent={report.user_agent!r} message={report.message!r}\n"
        f"stack={report.stack}\ncomponent_stack={report.component_stack}"
    )
