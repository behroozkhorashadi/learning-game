"""An uncaught error reported by the frontend.

The frontend is a kid-facing app with no dev tools open, so a crash (like the
crypto.randomUUID()-over-LAN bug that caused a blank screen) is otherwise invisible
until a parent notices. `POST /api/client-errors` lets the frontend's top-level
ErrorBoundary and window error/unhandledrejection handlers
(`frontend/src/lib/errorReporting.ts`) phone the crash home so it shows up in the
same place as everything else the server logs.

A wire shape: part of the API contract (`make check-api`), so it keeps pydantic's
default `extra="ignore"`.
"""

from pydantic import BaseModel, ConfigDict


class ClientErrorReport(BaseModel):
    model_config = ConfigDict(frozen=True)

    message: str
    stack: str | None = None
    component_stack: str | None = None
    source: str  # "react-error-boundary" | "window-error" | "unhandled-rejection"
    url: str
    user_agent: str
    profile_id: int | None = None
    game_id: str | None = None
