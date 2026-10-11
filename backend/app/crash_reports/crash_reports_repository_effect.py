"""A rotating log file of client error reports: `<log_dir>/client_errors.log`, 1 MB per
file, three backups, each entry prefixed with its time."""

import logging
from dataclasses import dataclass
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOGGER_NAME = "client_errors"
FILE_NAME = "client_errors.log"


@dataclass(frozen=True)
class FileClientErrorLog:
    logger: logging.Logger

    def write(self, entry: str) -> None:
        self.logger.error("%s", entry)


def make_file_client_error_log(*, log_dir: Path) -> FileClientErrorLog:
    """Creates `log_dir` if needed. Building a second log over the same directory
    reuses its file handler instead of writing every entry twice."""
    logger = logging.getLogger(f"{LOGGER_NAME}.{log_dir.resolve()}")
    logger.setLevel(logging.ERROR)
    if not logger.handlers:
        log_dir.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(log_dir / FILE_NAME, maxBytes=1_000_000, backupCount=3)
        handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
        logger.addHandler(handler)
    return FileClientErrorLog(logger=logger)
