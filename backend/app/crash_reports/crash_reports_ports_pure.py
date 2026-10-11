"""Where client error reports go, and the command the routes call."""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

from app.crash_reports.crash_reports_schemas_pure import ClientErrorReport


class ClientErrorLog(Protocol):
    def write(self, entry: str) -> None: ...


@dataclass(frozen=True)
class ClientErrorsService:
    report: Callable[[ClientErrorReport], None]
