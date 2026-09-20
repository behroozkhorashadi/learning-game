"""Logging sink for uncaught errors reported by the frontend.

The frontend is a kid-facing app with no dev tools open, so a crash (like the
crypto.randomUUID()-over-LAN bug that caused a blank screen) is otherwise
invisible until a parent notices something's wrong and goes digging in a
browser's console. `POST /api/client-errors` (see `main.py`) lets the
frontend's top-level ErrorBoundary and window error/unhandledrejection
handlers (see `frontend/src/lib/errorReporting.ts`) phone the crash home so
it shows up in the same place as everything else the server logs.
"""

from __future__ import annotations

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

from pydantic import BaseModel

LOG_DIR = Path(os.environ.get("LOG_DIR", "logs"))

logger = logging.getLogger("client_errors")
logger.setLevel(logging.ERROR)


def _ensure_file_handler() -> None:
    if any(isinstance(h, RotatingFileHandler) for h in logger.handlers):
        return
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(LOG_DIR / "client_errors.log", maxBytes=1_000_000, backupCount=3)
    handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    logger.addHandler(handler)


_ensure_file_handler()


class ClientErrorReport(BaseModel):
    message: str
    stack: Optional[str] = None
    component_stack: Optional[str] = None
    source: str  # "react-error-boundary" | "window-error" | "unhandled-rejection"
    url: str
    user_agent: str
    profile_id: Optional[int] = None
    game_id: Optional[str] = None


def log_client_error(report: ClientErrorReport) -> None:
    logger.error(
        "source=%s url=%s profile_id=%s game_id=%s user_agent=%r message=%r\nstack=%s\ncomponent_stack=%s",
        report.source,
        report.url,
        report.profile_id,
        report.game_id,
        report.user_agent,
        report.message,
        report.stack,
        report.component_stack,
    )
