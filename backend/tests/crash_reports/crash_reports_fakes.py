"""Fakes for the client-errors feature."""

from app.crash_reports.crash_reports_schemas_pure import ClientErrorReport


class InMemoryClientErrorLog:
    def __init__(self) -> None:
        self.entries: list[str] = []

    def write(self, entry: str) -> None:
        self.entries.append(entry)


def report(**overrides: object) -> ClientErrorReport:
    body: dict[str, object] = {
        "message": "boom",
        "source": "window-error",
        "url": "http://kid.local/",
        "user_agent": "Kidfox/1.0",
    }
    body.update(overrides)
    return ClientErrorReport.model_validate(body)
